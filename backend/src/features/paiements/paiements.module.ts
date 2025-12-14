import { Module } from '@nestjs/common';
import { PaiementsService } from './paiements.service';
import { PaiementsController } from './paiements.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PaiementsController],
    providers: [PaiementsService],
    exports: [PaiementsService],
})
export class PaiementsModule { }
