import { Controller, Get, Post, Body, Patch, Param, Delete, Put, Query } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Prisma } from '@prisma/client';

@Controller('clients')
export class ClientsController {
    constructor(private readonly clientsService: ClientsService) { }

    private mapPayloadToDto(body: any) {
        // Extract ALL fields from frontend
        const {
            type,
            typeClient,
            titre,
            nom,
            prenom,
            typePieceIdentite,
            numeroPieceIdentite,
            cinParent,
            dateNaissance,
            telephone,
            email,
            ville,
            adresse,
            codePostal,
            statut,
            couvertureSociale,
            dossierMedical,
            groupeFamille,
            // Professional fields
            raisonSociale,
            identifiantFiscal,
            ice,
            registreCommerce,
            patente,
            tvaAssujetti,
            numeroAutorisation,
            siteWeb,
            typePartenariat,
            facturationGroupee,
            convention,
            contacts,
        } = body;

        const finalType = typeClient || type;

        // Build DTO with ALL available fields
        const dto: any = {
            typeClient: finalType,
            civilite: titre, // Map titre -> civilite
            nom,
            prenom,
            typePieceIdentite,
            numeroPieceIdentite,
            cinParent,
            dateNaissance: dateNaissance ? new Date(dateNaissance) : undefined,
            telephone,
            email,
            ville,
            adresse,
            codePostal,
            statut,
            couvertureSociale,
            dossierMedical,
            groupeFamille,
            // Professional fields
            raisonSociale,
            identifiantFiscal,
            ice,
            registreCommerce,
            patente,
            tvaAssujetti,
            numeroAutorisation,
            siteWeb,
            convention,
            contacts,
        };

        // Remove undefined values to avoid Prisma errors
        Object.keys(dto).forEach(key => {
            if (dto[key] === undefined) {
                delete dto[key];
            }
        });

        return dto;
    }

    @Post()
    async create(@Body() body: any) {
        console.log('📥 CREATE Incoming payload:', JSON.stringify(body, null, 2));

        try {
            const createClientDto = this.mapPayloadToDto(body);
            console.log('🔄 Mapped CREATE DTO:', JSON.stringify(createClientDto, null, 2));
            return await this.clientsService.create(createClientDto);
        } catch (error) {
            console.error('❌ CREATE CLIENT ERROR:', error);
            throw error;
        }
    }

    @Get()
    findAll(@Query('nom') nom?: string) {
        return this.clientsService.findAll(nom);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.clientsService.findOne(id);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() body: any) {
        console.log('📥 UPDATE Incoming payload:', JSON.stringify(body, null, 2));

        try {
            // Apply the same mapping/cleaning logic as Create
            const updateClientDto = this.mapPayloadToDto(body);
            console.log('🔄 Mapped UPDATE DTO:', JSON.stringify(updateClientDto, null, 2));

            return await this.clientsService.update(id, updateClientDto);
        } catch (error) {
            console.error('❌ UPDATE CLIENT ERROR:', error);
            throw error;
        }
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.clientsService.remove(id);
    }
}
