import { describe, expect, it } from 'vitest';
import { AIService, OpenAIProvider, type OutreachMessageInput } from './index.js';

const baseInput: OutreachMessageInput = {
  objective: 'Book a creator partnership intro',
  languageCode: 'en',
  tone: 'PROFESSIONAL',
  length: 'MEDIUM',
  workspaceContext: { name: 'Development Workspace' },
  person: { id: 'person-1', displayName: 'Alex Morgan', firstName: 'Alex' },
  organization: { name: 'Northstar Media' },
  channels: [{ type: 'EMAIL', value: 'alex@example.com', isPrimary: true }],
  tags: ['Creator'],
  additionalContext: null,
  previousMessage: null,
  regenerationInstruction: null,
};

describe('AIService fake provider', () => {
  it('generates deterministic outreach copy', async () => {
    const service = new AIService({ provider: 'fake', model: 'fake-v1' });

    await expect(service.generateOutreachMessage(baseInput)).resolves.toEqual(
      await service.generateOutreachMessage(baseInput),
    );
  });

  it('uses person and organization context', async () => {
    const service = new AIService({ provider: 'fake', model: 'fake-v1' });
    const output = await service.generateOutreachMessage(baseInput);

    expect(output.subject).toContain('Northstar Media');
    expect(output.body).toContain('Alex');
  });

  it('runs deterministic intelligence operations', async () => {
    const service = new AIService({ provider: 'fake', model: 'fake-v1' });
    const output = await service.run('classify_intent', {
      workspace: { id: 'workspace-1', name: 'Development Workspace' },
      person: { id: 'person-1', displayName: 'Alex Morgan' },
      conversation: {
        id: 'conversation-1',
        subject: 'Re: Partnership',
        messages: [
          {
            from: 'alex@example.com',
            body: 'Yes, I am interested.',
            receivedAt: new Date(0).toISOString(),
          },
        ],
      },
    });

    expect(output.content).toBe('POSITIVE_REPLY');
  });

  it('constructs OpenAIProvider without an API key', async () => {
    const provider = new OpenAIProvider('gpt-test');

    await expect(provider.health()).resolves.toEqual({ ok: false, provider: 'openai' });
  });
});
