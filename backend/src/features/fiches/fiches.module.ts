import { Module } from '@nestjs/common';
import { FichesService } from './fiches.service';
import { FichesController } from './fiches.controller';

import { FacturesModule } from '../factures/factures.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
    imports: [FacturesModule, LoyaltyModule],
    controllers: [FichesController],
    providers: [FichesService],
})
export class FichesModule { }
