import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Headers, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { FacturesService } from './factures.service';
import { CreateFactureDto } from './dto/create-facture.dto';
import { UpdateFactureDto } from './dto/update-facture.dto';

@Controller('factures')
export class FacturesController {
    constructor(
        private readonly facturesService: FacturesService,
        private readonly configService: ConfigService
    ) { }

    @Post(':id/exchange')
    createExchange(
        @Param('id') id: string,
        @Body() body: { itemsToReturn: { lineIndex: number, quantiteRetour: number, reason: string, targetWarehouseId?: string }[] },
        @Headers('Tenant') centreId: string
    ) {
        return this.facturesService.createExchange(id, body.itemsToReturn, centreId);
    }

    @Post()
    create(
        @Body() createFactureDto: CreateFactureDto,
        @Headers('Tenant') centreId: string,
        @Headers('authorization') authHeader: string
    ) {
        if (centreId) {
            createFactureDto.centreId = centreId;
        }
        const userId = this.getUserId(authHeader);
        return this.facturesService.create(createFactureDto, userId);
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
                { statut: { not: 'ANNULEE' } }
            ];
        }

        return this.facturesService.findAll({
            where,
            orderBy: { createdAt: 'desc' },
            take: 500 // Increase limit to ensure we find older drafts being validated
        });
    }

    @Get(':id/check-availability')
    checkAvailability(@Param('id') id: string) {
        return this.facturesService.checkStockAvailability(id);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.facturesService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateFactureDto: UpdateFactureDto,
        @Headers('authorization') authHeader: string
    ) {
        const userId = this.getUserId(authHeader);
        return this.facturesService.update({
            where: { id },
            data: updateFactureDto,
        }, userId);
    }

    private getUserId(authHeader: string): string | undefined {
        if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
        try {
            const token = authHeader.split(' ')[1];
            const secret = this.configService.get<string>('JWT_SECRET') || 'your-very-secret-key';
            const payload = jwt.verify(token, secret) as any;
            return payload.sub;
        } catch (e) {
            return undefined;
        }
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.facturesService.remove({ id });
    }
}
