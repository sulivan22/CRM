import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { CommunicationChannelType, PersonStatus } from '@prisma/client';

export class PersonChannelDto {
  @IsEnum(CommunicationChannelType)
  type!: CommunicationChannelType;

  @IsString()
  @Length(1, 500)
  value!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreatePersonDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  lastName?: string;

  @IsString()
  @Length(1, 240)
  displayName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}(-[A-Za-z]{2})?$/)
  languageCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  followerCount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonChannelDto)
  channels?: PersonChannelDto[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];
}

export class UpdatePersonDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 240)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}(-[A-Za-z]{2})?$/)
  languageCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  followerCount?: number;

  @IsOptional()
  @IsEnum(PersonStatus)
  status?: PersonStatus;
}

export class AddTagDto {
  @IsUUID()
  tagId!: string;
}
