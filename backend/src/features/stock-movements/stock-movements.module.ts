import { Module } from '@nestjs/common';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsModule } from '../products/products.module';

@Module({
    imports: [ProductsModule],
    controllers: [StockMovementsController],
    providers: [StockMovementsService, PrismaService],
})
export class StockMovementsModule { }
