import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    Query,
    Put,
} from '@nestjs/common';
import { BonLivraisonService } from './bon-livraison.service';
import { CreateBonLivraisonDto } from './dto/create-bon-livraison.dto';

@Controller('bon-livraison')
export class BonLivraisonController {
    constructor(private readonly bonLivraisonService: BonLivraisonService) { }

    @Post()
    create(@Body() createDto: CreateBonLivraisonDto) {
        return this.bonLivraisonService.create(createDto);
    }

    @Get()
    findAll(
        @Query('fournisseurId') fournisseurId?: string,
        @Query('statut') statut?: string,
        @Query('clientId') clientId?: string,
        @Query('centreId') centreId?: string,
        @Query('ficheId') ficheId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('categorieBL') categorieBL?: string,
    ) {
        return this.bonLivraisonService.findAll({
            fournisseurId,
            statut,
            clientId,
            centreId,
            ficheId,
            startDate,
            endDate,
            page,
            limit,
            categorieBL,
        });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.bonLivraisonService.findOne(id);
    }

    @Put(':id')
    update(
        @Param('id') id: string,
        @Body() updateDto: Partial<CreateBonLivraisonDto>,
    ) {
        return this.bonLivraisonService.update(id, updateDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.bonLivraisonService.remove(id);
    }
}
