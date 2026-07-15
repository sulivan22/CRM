export const AI_PROCESSING_QUEUE = 'ai-processing';
export const AI_PROCESSING_JOB = 'ai.process';
export const PROMPT_VERSION = 'ai-intelligence-v1';

export type AIProviderName = 'fake' | 'openai';
export type AIOperation =
  'generate' | 'summarize' | 'extract' | 'classify_intent' | 'suggest_next_action';

export type OutreachMessageInput = {
  objective: string;
  languageCode: string;
  tone: string;
  length: string;
  workspaceContext: {
    name: string;
    brandSummary?: string;
    defaultLanguage?: string;
  };
  person: {
    id: string;
    displayName: string;
    firstName?: string | null;
    lastName?: string | null;
    jobTitle?: string | null;
    countryCode?: string | null;
    languageCode?: string | null;
    followerCount?: number | null;
  };
  organization?: {
    name: string;
    type?: string;
    website?: string | null;
    countryCode?: string | null;
  } | null;
  channels: {
    type: string;
    value: string;
    isPrimary?: boolean;
  }[];
  tags: string[];
  additionalContext?: string | null;
  previousMessage?: {
    subject: string;
    body: string;
    cta?: string | null;
  } | null;
  regenerationInstruction?: string | null;
};

export type OutreachMessageOutput = {
  subject: string;
  body: string;
  cta: string | null;
  provider: string;
  model: string;
  metadata: Record<string, string | number | boolean | null>;
};

export interface AIContext {
  workspace: { id: string; name: string };
  person?: {
    id: string;
    displayName: string;
    jobTitle?: string | null;
    organization?: string | null;
    tags?: string[];
    channels?: string[];
  } | null;
  conversation?: {
    id: string;
    subject?: string | null;
    messages: Array<{
      from: string;
      subject?: string | null;
      body?: string | null;
      receivedAt: string;
    }>;
  } | null;
  instruction?: string | null;
}

export interface AIResult {
  operation: AIOperation;
  title: string;
  content: string;
  confidence: number;
  data: Record<string, unknown>;
  provider: AIProviderName;
  model: string;
}

export interface PromptTemplate {
  operation: AIOperation;
  version: string;
  system: string;
  user: string;
}

export interface AIProvider {
  readonly name: AIProviderName;
  readonly model: string;
  generateOutreachMessage(input: OutreachMessageInput): Promise<OutreachMessageOutput>;
  regenerateOutreachMessage(input: OutreachMessageInput): Promise<OutreachMessageOutput>;
  run(operation: AIOperation, context: AIContext): Promise<AIResult>;
  health(): Promise<{ ok: boolean; provider: AIProviderName }>;
}

export interface AIProviderSettings {
  provider: AIProviderName;
  model: string;
  apiKey?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
}

export class FakeAIProvider implements AIProvider {
  readonly name = 'fake' as const;

  constructor(readonly model: string) {}

  generateOutreachMessage(input: OutreachMessageInput) {
    return Promise.resolve(this.buildMessage(input, false));
  }

  regenerateOutreachMessage(input: OutreachMessageInput) {
    return Promise.resolve(this.buildMessage(input, true));
  }

  run(operation: AIOperation, context: AIContext): Promise<AIResult> {
    const text = contextText(context);
    const personName = context.person?.displayName ?? 'this contact';
    const subject = context.conversation?.subject ?? 'conversation';
    const facts = [
      context.person?.jobTitle ? `Role: ${context.person.jobTitle}` : null,
      context.person?.organization ? `Organization: ${context.person.organization}` : null,
      context.person?.tags?.length ? `Tags: ${context.person.tags.join(', ')}` : null,
    ].filter(Boolean);

    const resultByOperation: Record<
      AIOperation,
      Omit<AIResult, 'operation' | 'provider' | 'model'>
    > = {
      generate: {
        title: `Generated draft for ${personName}`,
        content:
          `Draft a concise, helpful message for ${personName}. ${context.instruction ?? ''}`.trim(),
        confidence: 0.82,
        data: { source: 'fake', textLength: text.length },
      },
      summarize: {
        title: `Summary of ${subject}`,
        content: text
          ? `The thread is about ${subject}. Latest context: ${text.slice(0, 220)}`
          : `No message body is available for ${subject}.`,
        confidence: 0.8,
        data: { messages: context.conversation?.messages.length ?? 0 },
      },
      extract: {
        title: `Facts for ${personName}`,
        content: facts.length ? facts.join('\n') : `No explicit facts found for ${personName}.`,
        confidence: 0.74,
        data: { facts },
      },
      classify_intent: {
        title: `Intent for ${personName}`,
        content: inferIntent(text),
        confidence: 0.77,
        data: { intent: inferIntent(text) },
      },
      suggest_next_action: {
        title: `Next action for ${personName}`,
        content: suggestNextAction(text),
        confidence: 0.76,
        data: { action: suggestNextAction(text) },
      },
    };

    return Promise.resolve({
      operation,
      provider: this.name,
      model: this.model,
      ...resultByOperation[operation],
    });
  }

  health() {
    return Promise.resolve({ ok: true, provider: this.name });
  }

  private buildMessage(input: OutreachMessageInput, regenerated: boolean): OutreachMessageOutput {
    const name =
      input.person.firstName || input.person.displayName.split(' ')[0] || input.person.displayName;
    const organization = input.organization?.name ?? 'your team';
    const tone = input.tone.toLowerCase();
    const language = input.languageCode.toLowerCase();
    const length = input.length.toLowerCase();
    const tags = input.tags.length ? ` Tags: ${input.tags.join(', ')}.` : '';
    const channelHint =
      input.channels.find((channel) => channel.isPrimary)?.type ??
      input.channels[0]?.type ??
      'PROFILE';
    const regeneration = regenerated
      ? ` Regeneration note: ${input.regenerationInstruction || 'refresh the angle'}.`
      : '';
    const context = input.additionalContext ? ` Context: ${input.additionalContext}.` : '';
    const subjectPrefix = regenerated ? 'Updated idea' : 'Idea';

    const bodyParts = [
      `Hi ${name},`,
      `I am reaching out from ${input.workspaceContext.name} about ${input.objective}.`,
      `Your work${input.person.jobTitle ? ` as ${input.person.jobTitle}` : ''} at ${organization} looks relevant for this ${tone} outreach.`,
      length === 'short'
        ? 'Would it be worth a quick conversation?'
        : 'I drafted this with your audience and current channels in mind, and I think there is a practical way to explore fit without a long back-and-forth.',
      length === 'long'
        ? `The goal is to keep the first step concrete, useful, and easy to evaluate in ${language}.${tags}${context}${regeneration}`
        : `${tags}${context}${regeneration}`,
    ].filter(Boolean);

    return {
      subject: `${subjectPrefix} for ${organization}: ${input.objective}`.slice(0, 140),
      body: bodyParts.join('\n\n'),
      cta: 'Open to a quick review this week?',
      provider: this.name,
      model: this.model,
      metadata: {
        deterministic: true,
        language,
        tone,
        length,
        channelHint,
        regenerated,
      },
    };
  }
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai' as const;

  constructor(
    readonly model: string,
    private readonly apiKey?: string,
    private readonly temperature = 0.2,
    private readonly maxTokens = 800,
  ) {}

  async generateOutreachMessage(input: OutreachMessageInput) {
    const result = await this.completeJson<{
      subject?: string;
      body?: string;
      cta?: string | null;
    }>(templateFor('generate', outreachContext(input)));
    return {
      subject: String(
        result.subject ?? `Idea for ${input.organization?.name ?? input.person.displayName}`,
      ).slice(0, 140),
      body: String(result.body ?? ''),
      cta: result.cta ?? null,
      provider: this.name,
      model: this.model,
      metadata: { promptVersion: PROMPT_VERSION },
    };
  }

  regenerateOutreachMessage(input: OutreachMessageInput) {
    return this.generateOutreachMessage(input);
  }

  async run(operation: AIOperation, context: AIContext): Promise<AIResult> {
    const result = await this.completeJson<Partial<AIResult>>(templateFor(operation, context));
    return {
      operation,
      title: String(result.title ?? operation),
      content: String(result.content ?? ''),
      confidence: clampConfidence(result.confidence),
      data: isRecord(result.data) ? result.data : {},
      provider: this.name,
      model: this.model,
    };
  }

  health() {
    return Promise.resolve({ ok: Boolean(this.apiKey), provider: this.name });
  }

  private async completeJson<T extends Record<string, unknown>>(
    template: PromptTemplate,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai.');
    }
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        max_output_tokens: this.maxTokens,
        input: [
          { role: 'system', content: template.system },
          { role: 'user', content: template.user },
        ],
        text: { format: { type: 'json_object' } },
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      output_text?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(
        payload.error?.message ?? `OpenAI request failed with status ${response.status}`,
      );
    }
    const outputText = payload.output_text;
    if (!outputText) {
      throw new Error('OpenAI response did not include output_text.');
    }
    return JSON.parse(outputText) as T;
  }
}

export class AIService {
  private readonly provider: AIProvider;

  constructor(settings: AIProviderSettings) {
    this.provider = createAIProvider(settings);
  }

  generateOutreachMessage(input: OutreachMessageInput) {
    return this.provider.generateOutreachMessage(input);
  }

  regenerateOutreachMessage(input: OutreachMessageInput) {
    return this.provider.regenerateOutreachMessage(input);
  }

  run(operation: AIOperation, context: AIContext) {
    return this.provider.run(operation, context);
  }

  get providerName() {
    return this.provider.name;
  }

  get model() {
    return this.provider.model;
  }
}

export function createAIProvider(settings: AIProviderSettings): AIProvider {
  if (settings.provider === 'openai') {
    return new OpenAIProvider(
      settings.model,
      settings.apiKey ?? undefined,
      settings.temperature ?? 0.2,
      settings.maxTokens ?? 800,
    );
  }
  return new FakeAIProvider(settings.model);
}

export function templateFor(operation: AIOperation, context: AIContext): PromptTemplate {
  return {
    operation,
    version: PROMPT_VERSION,
    system:
      'You are an AI assistant for a CRM operator. Return compact JSON only with title, content, confidence, and data. Do not invent unsupported facts.',
    user: JSON.stringify({ operation, context }),
  };
}

function outreachContext(input: OutreachMessageInput): AIContext {
  return {
    workspace: { id: 'workspace', name: input.workspaceContext.name },
    person: {
      id: input.person.id,
      displayName: input.person.displayName,
      jobTitle: input.person.jobTitle,
      organization: input.organization?.name,
      tags: input.tags,
      channels: input.channels.map((channel) => channel.type),
    },
    instruction: [input.objective, input.tone, input.length, input.additionalContext]
      .filter(Boolean)
      .join('\n'),
  };
}

function contextText(context: AIContext) {
  return [
    context.instruction,
    ...(context.conversation?.messages.map((message) => message.body ?? message.subject ?? '') ??
      []),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

function inferIntent(text: string) {
  const value = text.toLowerCase();
  if (value.includes('interested') || value.includes('yes')) return 'POSITIVE_REPLY';
  if (value.includes('not interested') || value.includes('unsubscribe')) return 'NEGATIVE_REPLY';
  if (value.includes('later') || value.includes('next month')) return 'FOLLOW_UP_LATER';
  if (value.includes('?')) return 'QUESTION';
  return 'NEUTRAL_REPLY';
}

function suggestNextAction(text: string) {
  const intent = inferIntent(text);
  if (intent === 'POSITIVE_REPLY')
    return 'Prepare a short manual follow-up with scheduling options.';
  if (intent === 'NEGATIVE_REPLY')
    return 'Mark the contact as do-not-contact if the reply requests it.';
  if (intent === 'FOLLOW_UP_LATER') return 'Set a manual reminder outside this system.';
  if (intent === 'QUESTION') return 'Review the question and draft a human response.';
  return 'Review the conversation and decide whether a manual follow-up is appropriate.';
}

function clampConfidence(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0.7;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
