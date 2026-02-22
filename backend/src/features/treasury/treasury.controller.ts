import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { TreasuryService } from './treasury.service';

@Controller('treasury')
export class TreasuryController {
    constructor(private readonly treasuryService: TreasuryService) { }

    @Get('summary')
    getMonthlySummary(
        @Query('year') year: string,
        @Query('month') month: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('centreId') centreId?: string
    ) {
        return this.treasuryService.getMonthlySummary(
            parseInt(year) || new Date().getFullYear(),
            parseInt(month) || (new Date().getMonth() + 1),
            centreId,
            startDate,
            endDate
        );
    }

    @Get('consolidated-incomings')
    getConsolidatedIncomings(
        @Query('clientId') clientId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('centreId') centreId?: string,
        @Query('mode') mode?: string
    ) {
        return this.treasuryService.getConsolidatedIncomings({
            clientId,
            startDate,
            endDate,
            centreId,
            mode
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
        @Query('mode') mode?: string
    ) {
        return this.treasuryService.getConsolidatedOutgoings({
            fournisseurId,
            type,
            startDate,
            endDate,
            source,
            centreId,
            mode
        });
    }

    @Get('projection')
    getYearlyProjection(@Query('year') year: string, @Query('centreId') centreId?: string) {
        return this.treasuryService.getYearlyProjection(parseInt(year) || new Date().getFullYear(), centreId);
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

