import { Module } from '@nestjs/common';
import { FacturesService } from './factures.service';
import { FacturesController } from './factures.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
    imports: [PrismaModule, LoyaltyModule],
    controllers: [FacturesController],
    providers: [FacturesService],
    exports: [FacturesService]
})
export class FacturesModule { }
