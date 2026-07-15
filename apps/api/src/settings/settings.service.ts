import { BadRequestException, Injectable } from '@nestjs/common';
import { createAIProvider } from '@crm/ai';
import { createDeliveryProvider } from '@crm/delivery';
import { AuditService } from '../auth/audit.service.js';
import { PrismaService } from '../prisma.service.js';
import type {
  UpdateWorkspaceAISettingsDto,
  UpdateWorkspaceEmailSettingsDto,
  UpdateWorkspaceSettingsDto,
} from './dto.js';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getGeneral(workspaceId: string) {
    const settings = await this.ensureGeneral(workspaceId);
    return settings;
  }

  async updateGeneral(input: {
    actorUserId: string;
    workspaceId: string;
    dto: UpdateWorkspaceSettingsDto;
  }) {
    const settings = await this.ensureGeneral(input.workspaceId);
    const updated = await this.prismaService.client.workspaceSettings.update({
      where: { id: settings.id },
      data: {
        companyName: input.dto.companyName?.trim(),
        logoUrl: normalizeNullable(input.dto.logoUrl),
        timezone: input.dto.timezone?.trim(),
        locale: input.dto.locale?.trim(),
      },
    });
    await this.audit(input.workspaceId, input.actorUserId, 'workspace.settings.updated', [
      ...Object.keys(input.dto),
    ]);
    return updated;
  }

  async getAI(workspaceId: string) {
    return redactAI(await this.ensureAI(workspaceId));
  }

  async updateAI(input: {
    actorUserId: string;
    workspaceId: string;
    dto: UpdateWorkspaceAISettingsDto;
  }) {
    const settings = await this.ensureAI(input.workspaceId);
    const updated = await this.prismaService.client.workspaceAISettings.update({
      where: { id: settings.id },
      data: {
        provider: input.dto.provider,
        apiKey: apiKeyUpdate(input.dto.apiKey),
        model: input.dto.model?.trim(),
        temperature: input.dto.temperature,
        maxTokens: input.dto.maxTokens,
        enabled: input.dto.enabled,
      },
    });
    await this.audit(input.workspaceId, input.actorUserId, 'workspace.ai_settings.updated', [
      ...Object.keys(input.dto).filter((key) => key !== 'apiKey'),
      ...(input.dto.apiKey !== undefined ? ['apiKeyUpdated'] : []),
    ]);
    return redactAI(updated);
  }

  async testAI(workspaceId: string) {
    const settings = await this.ensureAI(workspaceId);
    if (!settings.enabled) {
      return { ok: false, provider: settings.provider, status: 'disabled' };
    }
    const provider = createAIProvider({
      provider: settings.provider === 'openai' ? 'openai' : 'fake',
      model: settings.model,
      apiKey: settings.apiKey,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    });
    const health = await provider.health();
    return {
      ok: health.ok,
      provider: settings.provider,
      status: health.ok ? 'ok' : 'missing_api_key',
    };
  }

  async getEmail(workspaceId: string) {
    return redactEmail(await this.ensureEmail(workspaceId));
  }

  async updateEmail(input: {
    actorUserId: string;
    workspaceId: string;
    dto: UpdateWorkspaceEmailSettingsDto;
  }) {
    const settings = await this.ensureEmail(input.workspaceId);
    const fromName = input.dto.fromName?.trim();
    const fromEmail = input.dto.fromEmail?.trim();
    if (fromName === '') throw new BadRequestException('fromName cannot be empty.');
    if (fromEmail === '') throw new BadRequestException('fromEmail cannot be empty.');
    const updated = await this.prismaService.client.workspaceEmailSettings.update({
      where: { id: settings.id },
      data: {
        provider: input.dto.provider,
        apiKey: apiKeyUpdate(input.dto.apiKey),
        domain: normalizeNullable(input.dto.domain),
        fromName,
        fromEmail,
        replyTo: normalizeNullable(input.dto.replyTo),
        enabled: input.dto.enabled,
      },
    });
    await this.audit(input.workspaceId, input.actorUserId, 'workspace.email_settings.updated', [
      ...Object.keys(input.dto).filter((key) => key !== 'apiKey'),
      ...(input.dto.apiKey !== undefined ? ['apiKeyUpdated'] : []),
    ]);
    return redactEmail(updated);
  }

  async testEmail(workspaceId: string) {
    const settings = await this.ensureEmail(workspaceId);
    if (!settings.enabled) {
      return { ok: false, provider: settings.provider, status: 'disabled' };
    }
    const provider = createDeliveryProvider({
      provider: settings.provider,
      apiKey: settings.apiKey,
    });
    const health = await provider.health();
    return {
      ok: health.ok,
      provider: settings.provider,
      status: health.ok ? 'ok' : 'missing_api_key',
    };
  }

  private async ensureGeneral(workspaceId: string) {
    const workspace = await this.prismaService.client.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    return (
      (await this.prismaService.client.workspaceSettings.findUnique({ where: { workspaceId } })) ??
      (await this.prismaService.client.workspaceSettings.create({
        data: {
          workspaceId,
          companyName: workspace.name,
          timezone: 'UTC',
          locale: 'en-US',
        },
      }))
    );
  }

  private async ensureAI(workspaceId: string) {
    return (
      (await this.prismaService.client.workspaceAISettings.findUnique({
        where: { workspaceId },
      })) ??
      (await this.prismaService.client.workspaceAISettings.create({
        data: { workspaceId, provider: 'fake', model: 'fake-v1', enabled: true },
      }))
    );
  }

  private async ensureEmail(workspaceId: string) {
    const workspace = await this.prismaService.client.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    return (
      (await this.prismaService.client.workspaceEmailSettings.findUnique({
        where: { workspaceId },
      })) ??
      (await this.prismaService.client.workspaceEmailSettings.create({
        data: {
          workspaceId,
          provider: 'fake',
          fromName: workspace.name,
          fromEmail: 'no-reply@example.test',
          enabled: true,
        },
      }))
    );
  }

  private async audit(workspaceId: string, actorUserId: string, action: string, fields: string[]) {
    await this.auditService.record({
      workspaceId,
      actorUserId,
      action,
      entityType: 'Workspace',
      entityId: workspaceId,
      metadata: { fields },
    });
  }
}

function redactAI(settings: {
  id: string;
  workspaceId: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  apiKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { apiKey, ...safe } = settings;
  return { ...safe, hasApiKey: Boolean(apiKey) };
}

function redactEmail(settings: {
  id: string;
  workspaceId: string;
  provider: string;
  domain: string | null;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  enabled: boolean;
  apiKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { apiKey, ...safe } = settings;
  return { ...safe, hasApiKey: Boolean(apiKey) };
}

function apiKeyUpdate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeNullable(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
