import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateWorkspaceSettingsDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class UpdateWorkspaceAISettingsDto {
  @IsOptional()
  @IsIn(['fake', 'openai'])
  provider?: string;

  @IsOptional()
  @IsString()
  apiKey?: string | null;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8000)
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateWorkspaceEmailSettingsDto {
  @IsOptional()
  @IsIn(['fake', 'resend'])
  provider?: string;

  @IsOptional()
  @IsString()
  apiKey?: string | null;

  @IsOptional()
  @IsString()
  domain?: string | null;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsEmail()
  replyTo?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
