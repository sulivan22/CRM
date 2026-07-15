import { IsIn, IsOptional, IsString, IsUUID, MaxLength, Matches } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;
}

export class UpdateMembershipDto {
  @IsOptional()
  @IsIn(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

  @IsOptional()
  @IsIn(['ACTIVE', 'INVITED', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
}

export class WorkspaceIdDto {
  @IsUUID()
  workspaceId!: string;
}
