import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { InboxService } from './inbox.service.js';

interface RawBodyRequest {
  body?: unknown;
  rawBody?: Buffer;
}

@Controller('webhooks/inbound')
export class InboundWebhookController {
  constructor(private readonly inboxService: InboxService) {}

  @Post('resend')
  @HttpCode(202)
  receiveResend(@Req() request: RawBodyRequest, @Headers() headers: Record<string, string>) {
    const rawBody = request.rawBody?.toString('utf8') ?? JSON.stringify(request.body ?? {});
    return this.inboxService.receiveResendWebhook({
      rawBody,
      headers: {
        id: headers['svix-id'],
        timestamp: headers['svix-timestamp'],
        signature: headers['svix-signature'],
      },
    });
  }
}
