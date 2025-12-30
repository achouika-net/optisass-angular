import { Module } from '@nestjs/common';
import { JourneeCaisseService } from './journee-caisse.service';
import { JourneeCaisseController } from './journee-caisse.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [JourneeCaisseController],
    providers: [JourneeCaisseService],
    exports: [JourneeCaisseService],
})
export class JourneeCaisseModule { }
