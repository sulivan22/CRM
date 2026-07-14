import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TagsController],
  providers: [PrismaService, TagsService],
  exports: [TagsService],
})
export class TagsModule {}
