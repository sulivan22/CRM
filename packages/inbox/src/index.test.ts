import { describe, expect, it } from 'vitest';
import { FakeInboundProvider, sanitizeInboundHtml } from './index.js';

describe('FakeInboundProvider', () => {
  it('normalizes fake inbound webhook payloads', () => {
    const provider = new FakeInboundProvider();
    const rawBody = JSON.stringify({
      id: 'evt_1',
      type: 'email.received',
      data: {
        providerMessageId: 'msg_1',
        deliveryProviderMessageId: 'fake_delivery_1',
        from: 'person@example.com',
        to: 'reply@example.test',
        subject: 'Re: Hello',
        textBody: 'Thanks',
      },
    });

    const verified = provider.verifyWebhook(rawBody, {});
    const normalized = provider.normalize(verified.payload);

    expect(verified.providerEventId).toBe('evt_1');
    expect(normalized?.providerMessageId).toBe('msg_1');
    expect(normalized?.deliveryProviderMessageId).toBe('fake_delivery_1');
  });
});

describe('sanitizeInboundHtml', () => {
  it('removes script and remote content vectors', () => {
    expect(
      sanitizeInboundHtml(
        '<p onclick="x()">Hi</p><img src="https://example.com/pixel.png"><script>alert(1)</script>',
      ),
    ).toBe('<p>Hi</p>');
  });
});
