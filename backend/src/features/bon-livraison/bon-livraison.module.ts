import { Module } from '@nestjs/common';
import { BonLivraisonService } from './bon-livraison.service';
import { BonLivraisonController } from './bon-livraison.controller';
import { ProductsModule } from '../products/products.module';

@Module({
    imports: [ProductsModule],
    controllers: [BonLivraisonController],
    providers: [BonLivraisonService],
    exports: [BonLivraisonService],
})
export class BonLivraisonModule { }
