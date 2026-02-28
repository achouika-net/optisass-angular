import { Controller, Get, Query, Headers } from '@nestjs/common';
import { StatsService } from './stats.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('stats')
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('diag-data')
  async diagData() {
    const [pCount, pSum, fCount, fSum] = await Promise.all([
      this.prisma.paiement.count(),
      this.prisma.paiement.aggregate({ _sum: { montant: true } }),
      this.prisma.facture.count(),
      this.prisma.facture.aggregate({ _sum: { totalHT: true } }),
    ]);
    return {
      payments: { count: pCount, sum: pSum._sum.montant },
      invoices: { count: fCount, sum: fSum._sum.totalHT },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('revenue-evolution')
  getRevenueEvolution(
    @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'monthly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getRevenueEvolution(
      period,
      startDate,
      endDate,
      centreId,
    );
  }

  @Get('product-distribution')
  getProductDistribution(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getProductDistribution(
      startDate,
      endDate,
      centreId,
    );
  }

  @Get('conversion-rate')
  getConversionRate(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getConversionRate(startDate, endDate, centreId);
  }

  @Get('stock-by-warehouse')
  getStockByWarehouse(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getStockByWarehouse(startDate, endDate, centreId);
  }

  @Get('top-clients')
  getTopClients(
    @Query('limit') limit: number = 10,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getTopClients(
      +limit,
      startDate,
      endDate,
      centreId,
    );
  }

  @Get('payment-methods')
  getPaymentMethods(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getPaymentMethods(startDate, endDate, centreId);
  }

  @Get('summary')
  getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getSummary(startDate, endDate, centreId);
  }

  @Get('profit')
  getRealProfit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getRealProfit(startDate, endDate, centreId);
  }

  @Get('profit-evolution')
  getProfitEvolution(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getProfitEvolution(startDate, endDate, centreId);
  }
}
