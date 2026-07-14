import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { PeopleController } from './people.controller.js';
import { PeopleService } from './people.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PeopleController],
  providers: [PrismaService, PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
