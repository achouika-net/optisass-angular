import { Controller, Get, Query, Headers } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
    constructor(private readonly statsService: StatsService) { }

    @Get('revenue-evolution')
    getRevenueEvolution(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'monthly',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string
    ) {
        return this.statsService.getRevenueEvolution(period, startDate, endDate, centreId);
    }

    @Get('product-distribution')
    getProductDistribution(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string
    ) {
        return this.statsService.getProductDistribution(startDate, endDate, centreId);
    }

    @Get('conversion-rate')
    getConversionRate(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string
    ) {
        return this.statsService.getConversionRate(startDate, endDate, centreId);
    }

    @Get('stock-by-warehouse')
    getStockByWarehouse(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string
    ) {
        return this.statsService.getStockByWarehouse(startDate, endDate, centreId);
    }

    @Get('top-clients')
    getTopClients(
        @Query('limit') limit: number = 10,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string
    ) {
        return this.statsService.getTopClients(+limit, startDate, endDate, centreId);
    }

    @Get('payment-methods')
    getPaymentMethods(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string
    ) {
        return this.statsService.getPaymentMethods(startDate, endDate, centreId);
    }

    @Get('summary')
    getSummary(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string
    ) {
        return this.statsService.getSummary(startDate, endDate, centreId);
    }

    @Get('profit')
    getRealProfit(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string
    ) {
        return this.statsService.getRealProfit(startDate, endDate, centreId);
    }

    @Get('profit-evolution')
    getProfitEvolution(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string
    ) {
        return this.statsService.getProfitEvolution(startDate, endDate, centreId);
    }
}
