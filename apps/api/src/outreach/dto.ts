import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CommunicationChannelType,
  GeneratedMessageStatus,
  OrganizationType,
  OutreachStatus,
} from '@prisma/client';

const toneOptions = ['PROFESSIONAL', 'FRIENDLY', 'DIRECT', 'WARM', 'PERSUASIVE'] as const;
const lengthOptions = ['SHORT', 'MEDIUM', 'LONG'] as const;

export class AudienceFiltersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsEnum(OrganizationType)
  organizationType?: OrganizationType;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}(-[A-Za-z]{2})?$/)
  languageCode?: string;

  @IsOptional()
  @IsEnum(CommunicationChannelType)
  channelType?: CommunicationChannelType;

  @IsOptional()
  @IsUUID()
  tagId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minFollowers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxFollowers?: number;

  @IsOptional()
  @IsBoolean()
  hasEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  hasInstagram?: boolean;
}

export class AudienceDto {
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  personIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  organizationIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFiltersDto)
  filters?: AudienceFiltersDto;
}

export class CreateOutreachDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsString()
  @Length(1, 2000)
  objective!: string;

  @IsString()
  @Matches(/^[A-Za-z]{2}(-[A-Za-z]{2})?$/)
  languageCode!: string;

  @IsIn(toneOptions)
  tone!: string;

  @IsIn(lengthOptions)
  length!: string;

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  additionalContext?: string;

  @ValidateNested()
  @Type(() => AudienceDto)
  audience!: AudienceDto;
}

export class ListOutreachQueryDto {
  @IsOptional()
  @IsEnum(OutreachStatus)
  status?: OutreachStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  createdByUserId?: string;

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

  @IsOptional()
  @IsString()
  sort?: string;
}

export class UpdateOutreachDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  objective?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}(-[A-Za-z]{2})?$/)
  languageCode?: string;

  @IsOptional()
  @IsIn(toneOptions)
  tone?: string;

  @IsOptional()
  @IsIn(lengthOptions)
  length?: string;

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  additionalContext?: string;
}

export class ListMessagesQueryDto {
  @IsOptional()
  @IsEnum(GeneratedMessageStatus)
  status?: GeneratedMessageStatus;

  @IsOptional()
  @IsString()
  recipientSearch?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasEmail?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasInstagram?: boolean;

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

export class UpdateMessageDto {
  @IsString()
  @Length(1, 200)
  subject!: string;

  @IsString()
  @Length(1, 10000)
  body!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  cta?: string | null;
}

export class RegenerateMessageDto {
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  instruction?: string;
}

export class ResolveAudienceDto {
  @ValidateNested()
  @Type(() => AudienceDto)
  audience!: AudienceDto;
}
