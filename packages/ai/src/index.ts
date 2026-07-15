import type { ServerEnv } from '@crm/config';

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

export interface AIProvider {
  generateOutreachMessage(input: OutreachMessageInput): Promise<OutreachMessageOutput>;
  regenerateOutreachMessage(input: OutreachMessageInput): Promise<OutreachMessageOutput>;
}

export class FakeAIProvider implements AIProvider {
  constructor(private readonly model: string) {}

  generateOutreachMessage(input: OutreachMessageInput) {
    return Promise.resolve(this.buildMessage(input, false));
  }

  regenerateOutreachMessage(input: OutreachMessageInput) {
    return Promise.resolve(this.buildMessage(input, true));
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
      provider: 'fake',
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

export class AIService {
  private readonly provider: AIProvider;

  constructor(env: Pick<ServerEnv, 'AI_PROVIDER' | 'AI_DEFAULT_MODEL'>) {
    if (env.AI_PROVIDER !== 'fake') {
      throw new Error('Unsupported AI provider');
    }
    this.provider = new FakeAIProvider(env.AI_DEFAULT_MODEL);
  }

  generateOutreachMessage(input: OutreachMessageInput) {
    return this.provider.generateOutreachMessage(input);
  }

  regenerateOutreachMessage(input: OutreachMessageInput) {
    return this.provider.regenerateOutreachMessage(input);
  }
}
