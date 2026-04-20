import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VirtualTryonService } from './virtual-tryon.service';
import { VirtualTryonController } from './virtual-tryon.controller';

@Module({
    providers: [VirtualTryonService, PrismaService],
    controllers: [VirtualTryonController],
    exports: [VirtualTryonService],
})
export class VirtualTryonModule { }
