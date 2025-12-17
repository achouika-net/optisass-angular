import { Module } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
    controllers: [WarehousesController],
    providers: [WarehousesService, PrismaService],
    exports: [WarehousesService],
})
export class WarehousesModule { }
