import { Module } from '@nestjs/common';
import { CaisseService } from './caisse.service';
import { CaisseController } from './caisse.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [CaisseController],
    providers: [CaisseService],
    exports: [CaisseService],
})
export class CaisseModule { }
