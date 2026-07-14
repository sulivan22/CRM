import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest, CookieResponse } from './auth.types.js';
import { CurrentUser } from './decorators.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto, SwitchWorkspaceDto } from './dto.js';
import { SessionService } from './session.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse
  ) {
    const result = await this.authService.register({
      ...dto,
      userAgent: this.userAgent(request),
      ipAddress: request.ip
    });
    this.sessionService.setSessionCookie(response, result.rawToken);
    return result.body;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse
  ) {
    const result = await this.authService.login({
      ...dto,
      userAgent: this.userAgent(request),
      ipAddress: request.ip
    });
    this.sessionService.setSessionCookie(response, result.rawToken);
    return result.body;
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse
  ) {
    if (request.session) {
      await this.sessionService.revokeSession(request.session.id);
    }
    this.sessionService.clearSessionCookie(response);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest, @CurrentUser() user: NonNullable<AuthenticatedRequest['user']>) {
    return this.authService.me(user.id, request.session?.activeWorkspaceId);
  }

  @Post('switch-workspace')
  @UseGuards(AuthGuard)
  switchWorkspace(@Body() dto: SwitchWorkspaceDto, @Req() request: AuthenticatedRequest) {
    if (!request.user || !request.session) {
      throw new Error('Auth guard did not attach request context');
    }
    return this.authService.switchWorkspace({
      userId: request.user.id,
      sessionId: request.session.id,
      workspaceId: dto.workspaceId
    });
  }

  private userAgent(request: AuthenticatedRequest) {
    const value = request.headers['user-agent'];
    return Array.isArray(value) ? value.join(' ') : value;
  }
}
