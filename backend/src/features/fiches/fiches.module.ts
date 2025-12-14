import { Module } from '@nestjs/common';
import { FichesService } from './fiches.service';
import { FichesController } from './fiches.controller';

import { FacturesModule } from '../factures/factures.module';

@Module({
    imports: [FacturesModule],
    controllers: [FichesController],
    providers: [FichesService],
})
export class FichesModule { }
