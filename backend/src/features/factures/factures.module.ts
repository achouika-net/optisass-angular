import { Module } from '@nestjs/common';
import { FacturesService } from './factures.service';
import { FacturesController } from './factures.controller';
import { StockAvailabilityService } from './stock-availability.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PaiementsModule } from '../paiements/paiements.module';
import { ProductsModule } from '../products/products.module';
import { PersonnelModule } from '../personnel/personnel.module';

@Module({
    imports: [PrismaModule, LoyaltyModule, PaiementsModule, ProductsModule, PersonnelModule],
    controllers: [FacturesController],
    providers: [FacturesService, StockAvailabilityService],
    exports: [FacturesService, StockAvailabilityService]
})
export class FacturesModule { }
