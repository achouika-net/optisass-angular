import { Module } from '@nestjs/common';
import { OperationCaisseService } from './operation-caisse.service';
import { OperationCaisseController } from './operation-caisse.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [OperationCaisseController],
    providers: [OperationCaisseService],
    exports: [OperationCaisseService],
})
export class OperationCaisseModule { }
