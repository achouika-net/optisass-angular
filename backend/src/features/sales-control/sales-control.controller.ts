import { Controller, Get, Post, Delete, Param, Query, UseGuards, Headers } from '@nestjs/common';
import { SalesControlService } from './sales-control.service';

@Controller('sales-control')
export class SalesControlController {
    constructor(private readonly salesControlService: SalesControlService) { }

    @Get('brouillon-with-payments')
    async getBrouillonWithPayments(@Query('userId') userId?: string, @Headers('Tenant') centreId?: string) {
        return this.salesControlService.getBrouillonWithPayments(userId, centreId);
    }

    @Get('brouillon-without-payments')
    async getBrouillonWithoutPayments(@Query('userId') userId?: string, @Headers('Tenant') centreId?: string) {
        return this.salesControlService.getBrouillonWithoutPayments(userId, centreId);
    }

    @Get('valid-invoices')
    async getValidInvoices(@Query('userId') userId?: string, @Headers('Tenant') centreId?: string) {
        return this.salesControlService.getValidInvoices(userId, centreId);
    }

    @Get('avoirs')
    async getAvoirs(@Query('userId') userId?: string, @Headers('Tenant') centreId?: string) {
        return this.salesControlService.getAvoirs(userId, centreId);
    }

    @Get('archived')
    async getArchivedInvoices(@Query('userId') userId?: string, @Headers('Tenant') centreId?: string) {
        return this.salesControlService.getArchivedInvoices(userId, centreId);
    }

    @Get('statistics')
    async getStatistics(@Headers('Tenant') centreId?: string) {
        return this.salesControlService.getStatisticsByVendor(centreId);
    }

    @Get('dashboard-data')
    async getDashboardData(@Query('userId') userId?: string, @Headers('Tenant') centreId?: string) {
        return this.salesControlService.getDashboardData(userId, centreId);
    }

    @Post('validate/:id')
    async validateInvoice(@Param('id') id: string) {
        return this.salesControlService.validateInvoice(id);
    }

    @Post('declare-gift/:id')
    async declareAsGift(@Param('id') id: string) {
        return this.salesControlService.declareAsGift(id);
    }

    @Post('archive/:id')
    async archiveInvoice(@Param('id') id: string) {
        return this.salesControlService.archiveInvoice(id);
    }

    // Delete is handled by existing factures controller
}
