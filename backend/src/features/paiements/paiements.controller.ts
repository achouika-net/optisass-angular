import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Headers } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { PaiementsService } from './paiements.service';
import { CreatePaiementDto } from './dto/create-paiement.dto';
import { UpdatePaiementDto } from './dto/update-paiement.dto';

@Controller('paiements')
export class PaiementsController {
    constructor(
        private readonly paiementsService: PaiementsService,
        private readonly configService: ConfigService
    ) { }

    @Post()
    create(@Body() createPaiementDto: CreatePaiementDto, @Headers('authorization') authHeader: string) {
        const userId = this.getUserId(authHeader);
        return this.paiementsService.create(createPaiementDto, userId);
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

    @Get()
    findAll(@Query('factureId') factureId?: string) {
        return this.paiementsService.findAll(factureId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.paiementsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updatePaiementDto: UpdatePaiementDto) {
        return this.paiementsService.update(id, updatePaiementDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.paiementsService.remove(id);
    }
}
