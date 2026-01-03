import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Headers } from '@nestjs/common';
import { FacturesService } from './factures.service';
import { CreateFactureDto } from './dto/create-facture.dto';
import { UpdateFactureDto } from './dto/update-facture.dto';

@Controller('factures')
export class FacturesController {
    constructor(private readonly facturesService: FacturesService) { }

    @Post(':id/exchange')
    createExchange(
        @Param('id') id: string,
        @Body() body: { itemsToReturn: { lineIndex: number, quantiteRetour: number, reason: string, targetWarehouseId?: string }[] },
        @Headers('Tenant') centreId: string
    ) {
        return this.facturesService.createExchange(id, body.itemsToReturn, centreId);
    }

    @Post()
    create(@Body() createFactureDto: CreateFactureDto, @Headers('Tenant') centreId: string) {
        if (centreId) {
            createFactureDto.centreId = centreId;
        }
        return this.facturesService.create(createFactureDto);
    }

    @Get()
    findAll(
        @Query('clientId') clientId?: string,
        @Query('type') type?: string,
        @Query('statut') statut?: string,
        @Query('ficheId') ficheId?: string,
        @Query('unpaid') unpaid?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Headers('Tenant') centreId?: string
    ) {
        // [FIX] If searching by FicheId (Unique Global), bypass Centre restriction to find "hidden" invoices from other centers/warehouses
        if (ficheId) {
            return this.facturesService.findAll({
                where: { ficheId },
                take: 1
            });
        }

        if (!centreId) return []; // Isolation
        const where: any = { centreId };
        if (clientId) where.clientId = clientId;
        if (type) where.type = type;
        if (statut) where.statut = statut;

        if (startDate || endDate) {
            const dateRange: any = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                dateRange.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateRange.lte = end;
            }
            where.createdAt = dateRange;
        }

        if (unpaid === 'true') {
            where.AND = [
                { resteAPayer: { gt: 0.05 } }, // Tolerance
                {
                    OR: [
                        { type: 'FACTURE' },
                        {
                            type: 'DEVIS',
                            statut: { in: ['VENTE_EN_INSTANCE', 'ARCHIVE'] }
                        }
                    ]
                }
            ];
        }

        return this.facturesService.findAll({
            where,
            orderBy: { createdAt: 'desc' },
            take: 500 // Increase limit to ensure we find older drafts being validated
        });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.facturesService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateFactureDto: UpdateFactureDto) {
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
