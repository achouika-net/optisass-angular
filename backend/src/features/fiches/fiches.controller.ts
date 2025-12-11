import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Query } from '@nestjs/common';
import { FichesService } from './fiches.service';
import { Prisma } from '@prisma/client';

@Controller('fiches')
export class FichesController {
    constructor(private readonly fichesService: FichesService) { }

    @Post()
    create(@Body() createFicheDto: Prisma.FicheCreateInput) {
        console.log('📥 Received fiche data:', JSON.stringify(createFicheDto, null, 2));
        return this.fichesService.create(createFicheDto);
    }

    @Get()
    findAll(@Query('clientId') clientId: string) {
        if (clientId) {
            return this.fichesService.findAllByClient(clientId);
        }
        return []; // Or implement strict findAll if needed
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.fichesService.findOne(id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateFicheDto: Prisma.FicheUpdateInput) {
        return this.fichesService.update(id, updateFicheDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.fichesService.remove(id);
    }
}
