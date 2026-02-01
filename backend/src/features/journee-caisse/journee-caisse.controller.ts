import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { JourneeCaisseService } from './journee-caisse.service';
import { OuvrirCaisseDto } from './dto/ouvrir-caisse.dto';
import { CloturerCaisseDto } from './dto/cloturer-caisse.dto';

@Controller('journee-caisse')
export class JourneeCaisseController {
    constructor(private readonly journeeCaisseService: JourneeCaisseService) { }

    @Post('ouvrir')
    ouvrir(@Body() ouvrirCaisseDto: OuvrirCaisseDto) {
        return this.journeeCaisseService.ouvrir(ouvrirCaisseDto);
    }

    @Post(':id/cloturer')
    cloturer(
        @Param('id') id: string,
        @Body() cloturerCaisseDto: CloturerCaisseDto,
    ) {
        return this.journeeCaisseService.cloturer(id, cloturerCaisseDto);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.journeeCaisseService.findOne(id);
    }

    @Get('caisse/:caisseId/active')
    getActiveByCaisse(@Param('caisseId') caisseId: string) {
        return this.journeeCaisseService.getActiveByCaisse(caisseId);
    }

    @Get('centre/:centreId')
    findByCentre(@Param('centreId') centreId: string) {
        return this.journeeCaisseService.findByCentre(centreId);
    }

    @Get('centre/:centreId/history')
    findHistory(
        @Param('centreId') centreId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.journeeCaisseService.findHistory(centreId, startDate, endDate);
    }

    @Get(':id/resume')
    getResume(
        @Param('id') id: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.journeeCaisseService.getResume(id, startDate, endDate);
    }

    @Get('caisse/:caisseId/last-balance')
    getLastClosingBalance(@Param('caisseId') caisseId: string) {
        return this.journeeCaisseService.getLastClosingBalance(caisseId);
    }
}
