import { Module } from '@nestjs/common';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { SupplierInvoicesController } from './supplier-invoices.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';

@Module({
    imports: [PrismaModule, ProductsModule],
    controllers: [SupplierInvoicesController],
    providers: [SupplierInvoicesService],
    exports: [SupplierInvoicesService],
})
export class SupplierInvoicesModule { }
