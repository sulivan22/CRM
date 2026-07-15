import { describe, expect, it } from 'vitest';
import { FakeDeliveryProvider, createDeliveryProvider } from './index.js';

describe('delivery providers', () => {
  it('uses deterministic fake provider message ids', async () => {
    const provider = new FakeDeliveryProvider();

    const result = await provider.send({
      idempotencyKey: 'delivery-1',
      fromName: 'CRM',
      fromEmail: 'crm@example.com',
      toEmail: 'person@example.com',
      subject: 'Hello',
      body: 'Body',
    });

    expect(result).toEqual({ provider: 'FAKE', providerMessageId: 'fake_delivery-1' });
  });

  it('requires a resend api key for resend provider', () => {
    expect(() => createDeliveryProvider({ provider: 'resend' })).toThrow(/api key/i);
  });
});
