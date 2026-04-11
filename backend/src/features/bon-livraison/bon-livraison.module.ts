import { Module } from '@nestjs/common';
import { BonLivraisonService } from './bon-livraison.service';
import { BonLivraisonController } from './bon-livraison.controller';
import { ProductsModule } from '../products/products.module';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({
    imports: [ProductsModule, ExpensesModule],
    controllers: [BonLivraisonController],
    providers: [BonLivraisonService],
    exports: [BonLivraisonService],
})
export class BonLivraisonModule { }
