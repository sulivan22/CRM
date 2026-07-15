import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;
}
