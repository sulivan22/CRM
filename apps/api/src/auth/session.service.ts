import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ServerEnv } from '@crm/config';
import { SERVER_ENV } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import type { AuthenticatedRequest, CookieOptions, CookieResponse } from './auth.types.js';

const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(
    @Inject(SERVER_ENV) private readonly env: ServerEnv,
    private readonly prismaService: PrismaService
  ) {}

  createRawToken() {
    return randomBytes(32).toString('base64url');
  }

  hashToken(rawToken: string) {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async createSession(input: {
    userId: string;
    activeWorkspaceId?: string | null;
    userAgent?: string | null;
    ipAddress?: string | null;
  }) {
    const rawToken = this.createRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.env.AUTH_SESSION_TTL_SECONDS * 1000);

    const session = await this.prismaService.client.session.create({
      data: {
        userId: input.userId,
        activeWorkspaceId: input.activeWorkspaceId,
        tokenHash,
        expiresAt,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress
      }
    });

    return { rawToken, session };
  }

  async validateRequest(request: AuthenticatedRequest) {
    const rawToken = this.getTokenFromRequest(request);
    if (!rawToken) {
      throw new UnauthorizedException('Authentication required');
    }

    const tokenHash = this.hashToken(rawToken);
    const session = await this.prismaService.client.session.findUnique({
      where: { tokenHash },
      include: { user: true, activeWorkspace: true }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Authentication required');
    }

    if (session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Authentication required');
    }

    const expected = Buffer.from(tokenHash);
    const actual = Buffer.from(session.tokenHash);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Authentication required');
    }

    if (Date.now() - session.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
      await this.prismaService.client.session.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() }
      });
    }

    return {
      session,
      user: session.user,
      activeWorkspace: session.activeWorkspace
    };
  }

  async revokeSession(sessionId: string) {
    await this.prismaService.client.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });
  }

  async cleanupExpiredSessions() {
    return this.prismaService.client.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }]
      }
    });
  }

  setSessionCookie(response: CookieResponse, rawToken: string) {
    response.cookie(this.env.AUTH_COOKIE_NAME, rawToken, this.cookieOptions());
  }

  clearSessionCookie(response: CookieResponse) {
    response.clearCookie(this.env.AUTH_COOKIE_NAME, {
      domain: this.env.AUTH_COOKIE_DOMAIN,
      path: '/',
      sameSite: 'lax',
      secure: this.useSecureCookie()
    });
  }

  getTokenFromRequest(request: AuthenticatedRequest) {
    const cookieHeader = request.headers.cookie;
    const rawCookie = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
    if (!rawCookie) {
      return null;
    }

    const cookies = rawCookie.split(';').map((part) => part.trim());
    const prefix = `${this.env.AUTH_COOKIE_NAME}=`;
    const match = cookies.find((cookie) => cookie.startsWith(prefix));
    return match ? decodeURIComponent(match.slice(prefix.length)) : null;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.useSecureCookie(),
      maxAge: this.env.AUTH_SESSION_TTL_SECONDS * 1000,
      domain: this.env.AUTH_COOKIE_DOMAIN,
      path: '/'
    };
  }

  private useSecureCookie() {
    return this.env.NODE_ENV === 'production' || this.env.AUTH_COOKIE_SECURE;
  }
}
