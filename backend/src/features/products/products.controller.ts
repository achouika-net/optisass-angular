import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Headers } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    @Get('transfers/history')
    getTransferHistory(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string,
        @Query('productId') productId?: string,
        @Query('type') type?: string
    ) {
        return this.productsService.getTransferHistory({ startDate, endDate, centreId, productId, type });
    }

    @Delete('cleanup-rupture')
    cleanupOutOfStock(@Headers('Tenant') centreId: string) {
        return this.productsService.cleanupOutOfStock(centreId);
    }

    @Get()
    findAll(
        @Query('entrepotId') entrepotId?: string,
        @Query('global') global?: string,
        @Query('marque') marque?: string,
        @Query('typeArticle') typeArticle?: string,
        @Query('reference') reference?: string,
        @Query('codeBarres') codeBarres?: string,
        @Headers('Tenant') centreId?: string
    ) {
        const isGlobal = global === 'true';
        return this.productsService.findAll(entrepotId, centreId, isGlobal, {
            marque,
            typeArticle,
            reference,
            codeBarres
        });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.productsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
        if ((updateProductDto as any).specificData) {
            console.warn(`🚨 [PRODUCT-UPDATE-TRAP] PATCH /products/${id} detected!`);
            console.warn(`   Source: Unknown (Check Network Tab)`);
            console.warn(`   Payload specificData keys: ${Object.keys((updateProductDto as any).specificData)}`);
            console.warn(`   PendingOutgoing in payload: ${(updateProductDto as any).specificData.pendingOutgoing ? 'PRESENT' : 'MISSING'}`);
        }
        return this.productsService.update(id, updateProductDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.productsService.remove(id);
    }

    @Post(':id/transfer')
    initiateTransfer(@Param('id') id: string, @Body() body: { targetProductId: string, quantite?: number }) {
        return this.productsService.initiateTransfer(id, body.targetProductId, body.quantite !== undefined ? Number(body.quantite) : undefined);
    }

    @Post(':id/ship')
    shipTransfer(@Param('id') id: string) {
        return this.productsService.shipTransfer(id);
    }

    @Post(':id/cancel')
    cancelTransfer(@Param('id') id: string) {
        return this.productsService.cancelTransfer(id);
    }

    @Post(':id/complete-transfer')
    completeTransfer(@Param('id') id: string) {
        return this.productsService.completeTransfer(id);
    }

    @Post(':id/restock')
    restock(@Param('id') id: string, @Body() body: { quantite: number; motif: string; utilisateur?: string; prixAchatHT?: number; remiseFournisseur?: number }) {
        return this.productsService.restock(
            id,
            Number(body.quantite),
            body.motif,
            body.utilisateur,
            body.prixAchatHT !== undefined ? Number(body.prixAchatHT) : undefined,
            body.remiseFournisseur !== undefined ? Number(body.remiseFournisseur) : undefined
        );
    }

    @Post(':id/destock')
    destock(@Param('id') id: string, @Body() body: { quantite: number; motif: string; destinationEntrepotId?: string; utilisateur?: string }) {
        return this.productsService.destock(
            id,
            Number(body.quantite),
            body.motif,
            body.destinationEntrepotId,
            body.utilisateur
        );
    }



}
