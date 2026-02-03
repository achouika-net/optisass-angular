import { Controller, Get, Post, Body, Param, Delete, Put, Query } from '@nestjs/common';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';

@Controller('supplier-invoices')
export class SupplierInvoicesController {
    constructor(private readonly service: SupplierInvoicesService) { }

    @Get('check-existence')
    async checkExistence(
        @Query('fournisseurId') fournisseurId: string,
        @Query('numeroFacture') numeroFacture: string
    ) {
        const invoice = await this.service.checkExistence(fournisseurId, numeroFacture);
        return {
            exists: !!invoice,
            invoice
        };
    }

    @Post()
    create(@Body() createDto: CreateSupplierInvoiceDto) {
        return this.service.create(createDto);
    }

    @Get()
    findAll(
        @Query('fournisseurId') fournisseurId?: string,
        @Query('statut') statut?: string,
        @Query('clientId') clientId?: string,
        @Query('centreId') centreId?: string,
        @Query('isBL') isBL?: string,
        @Query('categorieBL') categorieBL?: string,
        @Query('parentInvoiceId') parentInvoiceId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.service.findAll({
            fournisseurId,
            statut,
            clientId,
            centreId,
            isBL: isBL === 'true' ? true : isBL === 'false' ? false : undefined,
            categorieBL,
            parentInvoiceId,
            startDate,
            endDate
        });
    }

    @Post('group')
    groupToInvoice(@Body() body: { blIds: string[], targetInvoiceData: any }) {
        return this.service.groupBLsToInvoice(body.blIds, body.targetInvoiceData);
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
    getSituation(
        @Param('fournisseurId') fournisseurId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        return this.service.getSupplierSituation(fournisseurId, startDate, endDate);
    }
}
