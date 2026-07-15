import { IsIn, IsOptional, IsString } from 'class-validator';

export class AIRequestDto {
  @IsOptional()
  @IsString()
  personId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  instruction?: string;
}

export class ListAIInsightsQueryDto {
  @IsOptional()
  @IsString()
  personId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsIn([
    'REPLY_SUMMARY',
    'FACT_EXTRACTION',
    'INTENT_CLASSIFICATION',
    'NEXT_ACTION',
    'GENERATED_TEXT',
  ])
  type?: string;
}
