import { Controller, Get, Post, Body, Param, Delete, Put, Query } from '@nestjs/common';
import { StockMovementsService } from './stock-movements.service';
import { BulkAlimentationDto } from './dto/bulk-alimentation.dto';

@Controller('stock-movements')
export class StockMovementsController {
    constructor(private readonly service: StockMovementsService) { }

    @Post('bulk-alimentation')
    bulkAlimentation(@Body() dto: BulkAlimentationDto) {
        return this.service.processBulkAlimentation(dto);
    }

    @Get('product/:productId')
    findAllByProduct(@Param('productId') productId: string) {
        return this.service.findAllByProduct(productId);
    }

    @Get('history')
    getHistory(
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('supplierId') supplierId?: string,
        @Query('docType') docType?: string
    ) {
        return this.service.getHistory({ dateFrom, dateTo, supplierId, docType });
    }
}
