import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard.js';
import { WorkspaceMembershipGuard } from '../auth/workspace-membership.guard.js';
import { WorkspaceRolesGuard } from '../auth/workspace-roles.guard.js';
import { WorkspaceRoles } from '../auth/decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PeopleImportDto } from './dto.js';
import { ImportsService } from './imports.service.js';

type UploadedCsvFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Controller('workspaces/:workspaceId/imports')
@UseGuards(AuthGuard, WorkspaceMembershipGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('people')
  @UseGuards(WorkspaceRolesGuard)
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  @UseInterceptors(FileInterceptor('file'))
  createPeopleImport(
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Body() dto: PeopleImportDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) {
      throw new Error('Auth guard did not attach user');
    }
    return this.importsService.createPeopleImport({
      actorUserId: request.user.id,
      workspaceId,
      file,
      mapping: dto.mapping,
      overwriteExisting: dto.overwriteExisting,
    });
  }

  @Get(':importJobId')
  getJob(@Param('workspaceId') workspaceId: string, @Param('importJobId') importJobId: string) {
    return this.importsService.getJob(workspaceId, importJobId);
  }

  @Get(':importJobId/errors')
  listErrors(@Param('workspaceId') workspaceId: string, @Param('importJobId') importJobId: string) {
    return this.importsService.listErrors(workspaceId, importJobId);
  }
}
