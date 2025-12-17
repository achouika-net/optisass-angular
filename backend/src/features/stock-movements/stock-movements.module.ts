import { Module } from '@nestjs/common';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
    controllers: [StockMovementsController],
    providers: [StockMovementsService, PrismaService],
})
export class StockMovementsModule { }
