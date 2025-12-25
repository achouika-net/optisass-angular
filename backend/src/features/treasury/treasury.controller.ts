import { Controller, Get, Query } from '@nestjs/common';
import { TreasuryService } from './treasury.service';

@Controller('treasury')
export class TreasuryController {
    constructor(private readonly treasuryService: TreasuryService) { }

    @Get('summary')
    getMonthlySummary(
        @Query('year') year: string,
        @Query('month') month: string,
        @Query('centreId') centreId?: string
    ) {
        return this.treasuryService.getMonthlySummary(
            parseInt(year) || new Date().getFullYear(),
            parseInt(month) || (new Date().getMonth() + 1),
            centreId
        );
    }

    @Get('projection')
    getYearlyProjection(@Query('year') year: string) {
        return this.treasuryService.getYearlyProjection(parseInt(year) || new Date().getFullYear());
    }
}
