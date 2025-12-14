import { Module } from '@nestjs/common';
import { FacturesService } from './factures.service';
import { FacturesController } from './factures.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FacturesController],
    providers: [FacturesService],
    exports: [FacturesService]
})
export class FacturesModule { }
