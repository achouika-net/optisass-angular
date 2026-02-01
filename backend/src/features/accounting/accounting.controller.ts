import { Controller, Get, Query, Res } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { ExportSageDto } from './dto/export-sage.dto';
import { Response } from 'express';

@Controller('accounting')
export class AccountingController {
    constructor(private accountingService: AccountingService) { }

    @Get('export/sage')
    async exportSage(@Query() dto: ExportSageDto, @Res() res: Response) {
        try {
            const csv = await this.accountingService.generateSageExport(dto);
            const filename = `Sage_Export_${dto.startDate}_${dto.endDate}.csv`;

            res.set({
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });

            return res.send(csv);
        } catch (error) {
            console.error('Error in exportSage:', error);
            return res.status(500).json({ message: 'Erreur lors de la génération de l\'export Sage', error: error.message });
        }
    }

    @Get('export/pdf')
    async exportPdf(@Query() dto: ExportSageDto, @Res() res: Response) {
        try {
            const doc = await this.accountingService.generateJournalPdf(dto);
            const filename = `Journal_Comptable_${dto.startDate}_${dto.endDate}.pdf`;

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });

            doc.pipe(res);
        } catch (error) {
            console.error('Error in exportPdf:', error);
            return res.status(500).json({ message: 'Erreur lors de la génération du PDF', error: error.message });
        }
    }

    @Get('export/balance')
    async exportBalance(@Query() dto: ExportSageDto, @Res() res: Response) {
        try {
            const csv = await this.accountingService.generateTrialBalanceCsv(dto);
            const filename = `Balance_Comptable_${dto.startDate}_${dto.endDate}.csv`;

            res.set({
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });

            return res.send(csv);
        } catch (error) {
            console.error('Error in exportBalance:', error);
            return res.status(500).json({ message: 'Erreur lors de la génération de la Balance', error: error.message });
        }
    }

    @Get('export/bilan')
    async exportBilan(@Query() dto: ExportSageDto, @Res() res: Response) {
        try {
            const doc = await this.accountingService.generateBilanComptable(dto);
            const filename = `Bilan_Comptable_${dto.startDate}_${dto.endDate}.pdf`;

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            });

            doc.pipe(res);
        } catch (error) {
            console.error('Error in exportBilan:', error);
            return res.status(500).json({ message: 'Erreur lors de la génération du Bilan', error: error.message });
        }
    }
}
