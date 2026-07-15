import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { sanitizeUser } from './auth.presenters.js';
import { SessionService } from './session.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = await this.sessionService.validateRequest(request);
    request.user = sanitizeUser(auth.user);
    request.session = auth.session;
    request.currentWorkspace = auth.activeWorkspace ?? undefined;
    return true;
  }
}
