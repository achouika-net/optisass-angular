import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Headers } from '@nestjs/common';
import { FacturesService } from './factures.service';
import { Prisma } from '@prisma/client';

@Controller('factures')
export class FacturesController {
    constructor(private readonly facturesService: FacturesService) { }

    @Post(':id/exchange')
    createExchange(
        @Param('id') id: string,
        @Body() body: { itemsToReturn: { lineIndex: number, quantiteRetour: number, reason: string }[] },
        @Headers('Tenant') centreId: string
    ) {
        return this.facturesService.createExchange(id, body.itemsToReturn, centreId);
    }

    @Post()
    create(@Body() createFactureDto: Prisma.FactureUncheckedCreateInput, @Headers('Tenant') centreId: string) {
        if (centreId) {
            (createFactureDto as any).centreId = centreId;
        }
        return this.facturesService.create(createFactureDto);
    }

    @Get()
    findAll(
        @Query('clientId') clientId?: string,
        @Query('type') type?: string,
        @Query('statut') statut?: string,
        @Headers('Tenant') centreId?: string
    ) {
        if (!centreId) return []; // Isolation
        const where: any = { centreId };
        if (clientId) where.clientId = clientId;
        if (type) where.type = type;
        if (statut) where.statut = statut;

        return this.facturesService.findAll({
            where,
            orderBy: { createdAt: 'desc' }
        });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.facturesService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateFactureDto: Prisma.FactureUpdateInput) {
        return this.facturesService.update({
            where: { id },
            data: updateFactureDto,
        });
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.facturesService.remove({ id });
    }
}
