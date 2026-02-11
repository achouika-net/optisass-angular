import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClientsModule } from '../clients/clients.module';
import { ProductsModule } from '../products/products.module';

@Module({
    imports: [PrismaModule, ClientsModule, ProductsModule],
    controllers: [ImportsController],
    providers: [ImportsService],
    exports: [ImportsService],
})
export class ImportsModule { }
