import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Headers } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Post()
    create(@Body() createProductDto: CreateProductDto) {
        return this.productsService.create(createProductDto);
    }

    @Get('stats')
    getStockStats(@Headers('Tenant') centreId?: string) {
        return this.productsService.getStockStats(centreId);
    }

    @Get()
    findAll(@Query('entrepotId') entrepotId?: string, @Headers('Tenant') centreId?: string) {
        return this.productsService.findAll(entrepotId, centreId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.productsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
        return this.productsService.update(id, updateProductDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.productsService.remove(id);
    }

    @Post(':id/initiate-transfer')
    initiateTransfer(@Param('id') id: string, @Body('targetWarehouseId') targetWarehouseId: string) {
        return this.productsService.initiateTransfer(id, targetWarehouseId);
    }

    @Post(':id/complete-transfer')
    completeTransfer(@Param('id') id: string) {
        return this.productsService.completeTransfer(id);
    }
}
