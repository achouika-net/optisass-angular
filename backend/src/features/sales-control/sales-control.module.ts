import { Module } from '@nestjs/common';
import { SalesControlService } from './sales-control.service';
import { SalesControlController } from './sales-control.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FacturesModule } from '../factures/factures.module';

@Module({
    imports: [PrismaModule, FacturesModule],
    controllers: [SalesControlController],
    providers: [SalesControlService],
    exports: [SalesControlService]
})
export class SalesControlModule { }
