import { Module } from '@nestjs/common';
import { CentersService } from './centers.service';
import { CentersController } from './centers.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
    controllers: [CentersController],
    providers: [CentersService, PrismaService],
    exports: [CentersService],
})
export class CentersModule { }
