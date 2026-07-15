import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DeliveryStatus } from '@crm/database';

export class SendOutreachDto {
  @IsOptional()
  @IsBoolean()
  retryFailed?: boolean;
}

export class ListDeliveriesQueryDto {
  @IsOptional()
  @IsString()
  outreachId?: string;

  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

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
