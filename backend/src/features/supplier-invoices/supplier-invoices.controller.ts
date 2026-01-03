import { Controller, Get, Post, Body, Param, Delete, Put, Query } from '@nestjs/common';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';

@Controller('supplier-invoices')
export class SupplierInvoicesController {
    constructor(private readonly service: SupplierInvoicesService) { }

    @Post()
    create(@Body() createDto: CreateSupplierInvoiceDto) {
        return this.service.create(createDto);
    }

    @Get()
    findAll(
        @Query('fournisseurId') fournisseurId?: string,
        @Query('statut') statut?: string,
        @Query('clientId') clientId?: string
    ) {
        return this.service.findAll(fournisseurId, statut, clientId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateDto: any) {
        return this.service.update(id, updateDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.service.remove(id);
    }

    @Get('situation/:fournisseurId')
    getSituation(@Param('fournisseurId') fournisseurId: string) {
        return this.service.getSupplierSituation(fournisseurId);
    }
}
