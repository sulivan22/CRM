import { createHash } from 'node:crypto';
import { Webhook } from 'svix';

export const INBOUND_EMAIL_QUEUE = 'inbound-email-processing';
export const INBOUND_EMAIL_JOB = 'inbound-email.process';

export type InboundProviderName = 'FAKE' | 'RESEND';

export interface InboundWebhookHeaders {
  id?: string;
  timestamp?: string;
  signature?: string;
}

export interface VerifiedInboundWebhook {
  provider: InboundProviderName;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  payloadHash: string;
}

export interface NormalizedInboundMessage {
  provider: InboundProviderName;
  providerMessageId: string;
  providerThreadId?: string | null;
  deliveryProviderMessageId?: string | null;
  fromAddress: string;
  toAddress: string;
  replyToAddress?: string | null;
  subject?: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
  headers?: Record<string, unknown> | null;
  receivedAt: Date;
  rawMetadata: Record<string, unknown>;
}

export interface InboundProvider {
  verifyWebhook(rawBody: string, headers: InboundWebhookHeaders): VerifiedInboundWebhook;
  normalize(payload: Record<string, unknown>): NormalizedInboundMessage | null;
  health(): Promise<{ ok: boolean; provider: InboundProviderName }>;
}

export class FakeInboundProvider implements InboundProvider {
  verifyWebhook(rawBody: string, headers: InboundWebhookHeaders): VerifiedInboundWebhook {
    const payload = parseJsonObject(rawBody);
    return {
      provider: 'FAKE',
      providerEventId: headers.id ?? stringField(payload, 'id') ?? `fake_${hashPayload(rawBody)}`,
      eventType: stringField(payload, 'type') ?? 'email.received',
      payload,
      payloadHash: hashPayload(rawBody),
    };
  }

  normalize(payload: Record<string, unknown>): NormalizedInboundMessage | null {
    const data = objectField(payload, 'data') ?? payload;
    const providerMessageId =
      stringField(data, 'providerMessageId') ?? stringField(data, 'email_id');
    const fromAddress = stringField(data, 'from');
    const toAddress = firstStringField(data, 'to');
    if (!providerMessageId || !fromAddress || !toAddress) {
      return null;
    }

    return {
      provider: 'FAKE',
      providerMessageId,
      providerThreadId: stringField(data, 'threadId'),
      deliveryProviderMessageId: stringField(data, 'deliveryProviderMessageId'),
      fromAddress,
      toAddress,
      replyToAddress: stringField(data, 'replyTo'),
      subject: stringField(data, 'subject'),
      textBody: stringField(data, 'textBody') ?? stringField(data, 'text'),
      htmlBody: sanitizeInboundHtml(stringField(data, 'htmlBody') ?? stringField(data, 'html')),
      headers: objectField(data, 'headers'),
      receivedAt: parseDate(stringField(data, 'receivedAt')) ?? new Date(),
      rawMetadata: data,
    };
  }

  health() {
    return Promise.resolve({ ok: true, provider: 'FAKE' as const });
  }
}

export class ResendInboundProvider implements InboundProvider {
  constructor(private readonly webhookSecret: string) {}

  verifyWebhook(rawBody: string, headers: InboundWebhookHeaders): VerifiedInboundWebhook {
    if (!this.webhookSecret) {
      throw new Error('Resend webhook secret is required.');
    }
    const webhook = new Webhook(this.webhookSecret);
    const providerEventId = requiredHeader(headers.id, 'svix-id');
    const payload = webhook.verify(rawBody, {
      'svix-id': providerEventId,
      'svix-timestamp': requiredHeader(headers.timestamp, 'svix-timestamp'),
      'svix-signature': requiredHeader(headers.signature, 'svix-signature'),
    });
    if (!isRecord(payload)) {
      throw new Error('Invalid Resend webhook payload.');
    }

    return {
      provider: 'RESEND',
      providerEventId,
      eventType: stringField(payload, 'type') ?? 'unknown',
      payload,
      payloadHash: hashPayload(rawBody),
    };
  }

  normalize(payload: Record<string, unknown>): NormalizedInboundMessage | null {
    if (stringField(payload, 'type') !== 'email.received') {
      return null;
    }

    const data = objectField(payload, 'data');
    if (!data) {
      return null;
    }

    const providerMessageId = stringField(data, 'email_id') ?? stringField(data, 'id');
    const fromAddress = stringField(data, 'from');
    const toAddress = firstStringField(data, 'to') ?? stringField(data, 'received_for');
    if (!providerMessageId || !fromAddress || !toAddress) {
      return null;
    }

    return {
      provider: 'RESEND',
      providerMessageId,
      providerThreadId: stringField(data, 'thread_id'),
      deliveryProviderMessageId:
        stringField(data, 'delivery_provider_message_id') ?? stringField(data, 'in_reply_to'),
      fromAddress,
      toAddress,
      replyToAddress: firstStringField(data, 'reply_to'),
      subject: stringField(data, 'subject'),
      textBody: stringField(data, 'text') ?? stringField(data, 'text_body'),
      htmlBody: sanitizeInboundHtml(stringField(data, 'html') ?? stringField(data, 'html_body')),
      headers: objectField(data, 'headers'),
      receivedAt: parseDate(stringField(data, 'created_at')) ?? new Date(),
      rawMetadata: data,
    };
  }

  health() {
    return Promise.resolve({ ok: this.webhookSecret.length > 0, provider: 'RESEND' as const });
  }
}

export function createInboundProvider(input: {
  provider: string;
  webhookSecret?: string | null;
}): InboundProvider {
  if (input.provider === 'RESEND') {
    return new ResendInboundProvider(input.webhookSecret ?? '');
  }
  return new FakeInboundProvider();
}

export function hashPayload(rawBody: string) {
  return createHash('sha256').update(rawBody).digest('hex');
}

export function sanitizeInboundHtml(html?: string | null) {
  if (!html) {
    return html;
  }
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(img|source|track|video|audio|link)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s+(src|srcset|href)\s*=\s*(['"])\s*https?:\/\/.*?\2/gi, '');
}

function parseJsonObject(rawBody: string) {
  const parsed = JSON.parse(rawBody) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Webhook payload must be a JSON object.');
  }
  return parsed;
}

function requiredHeader(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} header is required.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return isRecord(field) ? field : undefined;
}

function stringField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === 'string' && field.length > 0 ? field : undefined;
}

function firstStringField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  if (typeof field === 'string' && field.length > 0) {
    return field;
  }
  if (Array.isArray(field)) {
    return field.find((item): item is string => typeof item === 'string' && item.length > 0);
  }
  return undefined;
}

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
