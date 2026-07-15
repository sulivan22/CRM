import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ConversationStatus } from '@crm/database';

export class ListInboxQueryDto {
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsString()
  personId?: string;

  @IsOptional()
  @IsString()
  outreachId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class UpdateConversationDto {
  @IsEnum(ConversationStatus)
  status!: ConversationStatus;
}

export class SimulateInboundDto {
  @IsString()
  deliveryId!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  textBody?: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;
}
