import { Module } from '@nestjs/common';
import { FacturesService } from './factures.service';
import { FacturesController } from './factures.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PaiementsModule } from '../paiements/paiements.module';
import { ProductsModule } from '../products/products.module';

@Module({
    imports: [PrismaModule, LoyaltyModule, PaiementsModule, ProductsModule],
    controllers: [FacturesController],
    providers: [FacturesService],
    exports: [FacturesService]
})
export class FacturesModule { }
