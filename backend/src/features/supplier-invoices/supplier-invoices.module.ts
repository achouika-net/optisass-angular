import { Module } from '@nestjs/common';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { SupplierInvoicesController } from './supplier-invoices.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SupplierInvoicesController],
    providers: [SupplierInvoicesService],
    exports: [SupplierInvoicesService],
})
export class SupplierInvoicesModule { }
