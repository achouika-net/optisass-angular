import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { TreasuryService } from './treasury.service';

@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) { }

  @Get('consolidated-unpaid-final')
  getConsolidatedUnpaid(
    @Query('clientId') clientId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    console.log(`[TREASURY-CONT] getConsolidatedUnpaid called. Params:`, { clientId, startDate, endDate, centreId, page, limit });
    return this.treasuryService.getConsolidatedUnpaid({
      clientId,
      startDate,
      endDate,
      centreId,
      page,
      limit,
    });
  }

  @Get('summary')
  getMonthlySummary(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    const parsedYear =
      year !== undefined ? parseInt(year) : new Date().getFullYear();
    const parsedMonth =
      month !== undefined ? parseInt(month) : new Date().getMonth() + 1;

    return this.treasuryService.getMonthlySummary(
      isNaN(parsedYear) ? new Date().getFullYear() : parsedYear,
      isNaN(parsedMonth) ? new Date().getMonth() + 1 : parsedMonth,
      centreId,
      startDate,
      endDate,
    );
  }

  @Get('consolidated-incomings')
  getConsolidatedIncomings(
    @Query('clientId') clientId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
    @Query('mode') mode?: string,
    @Query('statut') statut?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.treasuryService.getConsolidatedIncomings({
      clientId,
      startDate,
      endDate,
      centreId,
      type: mode,
      statut,
      page,
      limit,
    });
  }

  @Get('consolidated-outgoings')
  getConsolidatedOutgoings(
    @Query('fournisseurId') fournisseurId?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('source') source?: string,
    @Query('centreId') centreId?: string,
    @Query('mode') mode?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.treasuryService.getConsolidatedOutgoings({
      fournisseurId,
      type,
      startDate,
      endDate,
      source,
      centreId,
      mode,
      page,
      limit,
    });
  }

  @Get('projection')
  getYearlyProjection(
    @Query('year') year: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.treasuryService.getYearlyProjection(
      parseInt(year) || new Date().getFullYear(),
      centreId,
    );
  }

  @Get('config')
  getConfig() {
    return this.treasuryService.getConfig();
  }

  @Post('config')
  updateConfig(@Body('monthlyThreshold') threshold: number) {
    return this.treasuryService.updateConfig(threshold);
  }

  @Post('echeances/:id/validate')
  validateEcheance(@Param('id') id: string, @Body('statut') statut: string) {
    return this.treasuryService.updateEcheanceStatus(id, statut || 'ENCAISSE');
  }

  @Get('pending-alerts')
  getPendingAlerts(@Query('centreId') centreId?: string) {
    return this.treasuryService.getPendingAlerts(centreId);
  }
}
