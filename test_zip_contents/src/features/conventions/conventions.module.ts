import { Module } from '@nestjs/common';
import { ConventionsService } from './conventions.service';
import { ConventionsController } from './conventions.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConventionsController],
  providers: [ConventionsService],
  exports: [ConventionsService],
})
export class ConventionsModule {}
