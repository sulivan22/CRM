import { describe, expect, it } from 'vitest';
import { AIService, type OutreachMessageInput } from './index.js';

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
    const service = new AIService({ AI_PROVIDER: 'fake', AI_DEFAULT_MODEL: 'fake-v1' });

    await expect(service.generateOutreachMessage(baseInput)).resolves.toEqual(
      await service.generateOutreachMessage(baseInput),
    );
  });

  it('uses person and organization context', async () => {
    const service = new AIService({ AI_PROVIDER: 'fake', AI_DEFAULT_MODEL: 'fake-v1' });
    const output = await service.generateOutreachMessage(baseInput);

    expect(output.subject).toContain('Northstar Media');
    expect(output.body).toContain('Alex');
  });
});
