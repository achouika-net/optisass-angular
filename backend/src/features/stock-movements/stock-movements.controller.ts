import { Controller, Get, Param } from '@nestjs/common';
import { StockMovementsService } from './stock-movements.service';

@Controller('stock-movements')
export class StockMovementsController {
    constructor(private readonly service: StockMovementsService) { }

    @Get('product/:productId')
    findAllByProduct(@Param('productId') productId: string) {
        return this.service.findAllByProduct(productId);
    }
}
