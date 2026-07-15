export const DELIVERY_SEND_QUEUE = 'delivery-send';
export const DELIVERY_SEND_JOB = 'delivery.send';

export type DeliveryProviderName = 'FAKE' | 'RESEND';

export interface DeliveryMessage {
  idempotencyKey: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
  toEmail: string;
  subject: string;
  body: string;
}

export interface DeliverySendResult {
  provider: DeliveryProviderName;
  providerMessageId: string;
}

export interface DeliveryProvider {
  send(message: DeliveryMessage): Promise<DeliverySendResult>;
  health(): Promise<{ ok: boolean; provider: DeliveryProviderName }>;
}

export class FakeDeliveryProvider implements DeliveryProvider {
  send(message: DeliveryMessage): Promise<DeliverySendResult> {
    return Promise.resolve({
      provider: 'FAKE',
      providerMessageId: `fake_${message.idempotencyKey}`,
    });
  }

  health() {
    return Promise.resolve({ ok: true, provider: 'FAKE' as const });
  }
}

export class ResendProvider implements DeliveryProvider {
  constructor(private readonly apiKey: string) {}

  async send(message: DeliveryMessage): Promise<DeliverySendResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': message.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${message.fromName} <${message.fromEmail}>`,
        to: [message.toEmail],
        reply_to: message.replyTo || undefined,
        subject: message.subject,
        text: message.body,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !payload.id) {
      throw new Error(payload.message || `Resend request failed with status ${response.status}`);
    }

    return {
      provider: 'RESEND',
      providerMessageId: payload.id,
    };
  }

  health() {
    return Promise.resolve({ ok: this.apiKey.length > 0, provider: 'RESEND' as const });
  }
}

export function createDeliveryProvider(input: {
  provider: string;
  apiKey?: string | null;
}): DeliveryProvider {
  if (input.provider === 'RESEND') {
    if (!input.apiKey) {
      throw new Error('Resend API key is required for delivery.');
    }
    return new ResendProvider(input.apiKey);
  }

  return new FakeDeliveryProvider();
}
