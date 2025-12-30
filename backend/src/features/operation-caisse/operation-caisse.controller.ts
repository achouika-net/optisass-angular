import { Controller, Get, Post, Body, Param, Delete, Query } from '@nestjs/common';
import { OperationCaisseService } from './operation-caisse.service';
import { CreateOperationCaisseDto } from './dto/create-operation-caisse.dto';

@Controller('operation-caisse')
export class OperationCaisseController {
    constructor(
        private readonly operationCaisseService: OperationCaisseService,
    ) { }

    @Post()
    create(
        @Body() createOperationDto: CreateOperationCaisseDto,
        @Query('userRole') userRole?: string,
    ) {
        return this.operationCaisseService.create(createOperationDto, userRole);
    }

    @Get('journee/:journeeId')
    findByJournee(@Param('journeeId') journeeId: string) {
        return this.operationCaisseService.findByJournee(journeeId);
    }

    @Get('journee/:journeeId/stats')
    getStatsByJournee(@Param('journeeId') journeeId: string) {
        return this.operationCaisseService.getStatsByJournee(journeeId);
    }

    @Post('transfer')
    transfer(
        @Body() transferDto: {
            amount: number;
            fromJourneeId: string;
            toJourneeId: string;
            utilisateur: string;
        },
    ) {
        return this.operationCaisseService.transfer(transferDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Query('userRole') userRole?: string) {
        return this.operationCaisseService.remove(id, userRole);
    }
}
