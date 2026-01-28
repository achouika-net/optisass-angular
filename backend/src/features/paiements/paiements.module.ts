import { Module } from '@nestjs/common';
import { PaiementsService } from './paiements.service';
import { PaiementsController } from './paiements.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { forwardRef } from '@nestjs/common';
import { FacturesModule } from '../factures/factures.module';

import { PersonnelModule } from '../personnel/personnel.module';

@Module({
    imports: [PrismaModule, forwardRef(() => FacturesModule), PersonnelModule],
    controllers: [PaiementsController],
    providers: [PaiementsService],
    exports: [PaiementsService],
})
export class PaiementsModule { }
