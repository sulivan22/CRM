import { Transform } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import type { PeopleImportField } from '@crm/database';

export class PeopleImportDto {
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    const raw: unknown = value;
    if (typeof raw !== 'string') {
      return typeof raw === 'object' && raw !== null
        ? (raw as Partial<Record<PeopleImportField, string>>)
        : {};
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed as Partial<Record<PeopleImportField, string>>;
    } catch {
      return {};
    }
  })
  mapping?: Partial<Record<PeopleImportField, string>>;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  overwriteExisting?: boolean;
}
