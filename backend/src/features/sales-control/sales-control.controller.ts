import { Controller, Get, Post, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { SalesControlService } from './sales-control.service';

@Controller('sales-control')
export class SalesControlController {
    constructor(private readonly salesControlService: SalesControlService) { }

    @Get('brouillon-with-payments')
    async getBrouillonWithPayments(@Query('userId') userId?: string) {
        return this.salesControlService.getBrouillonWithPayments(userId);
    }

    @Get('brouillon-without-payments')
    async getBrouillonWithoutPayments(@Query('userId') userId?: string) {
        return this.salesControlService.getBrouillonWithoutPayments(userId);
    }

    @Get('statistics')
    async getStatistics() {
        return this.salesControlService.getStatisticsByVendor();
    }

    @Post('validate/:id')
    async validateInvoice(@Param('id') id: string) {
        return this.salesControlService.validateInvoice(id);
    }

    @Post('declare-gift/:id')
    async declareAsGift(@Param('id') id: string) {
        return this.salesControlService.declareAsGift(id);
    }

    // Delete is handled by existing factures controller
}
