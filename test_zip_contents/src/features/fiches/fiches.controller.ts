import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
} from '@nestjs/common';
import { FichesService } from './fiches.service';
import { CreateFicheDto } from './dto/create-fiche.dto';
import { UpdateFicheDto } from './dto/update-fiche.dto';

@Controller('fiches')
export class FichesController {
  constructor(private readonly fichesService: FichesService) {}

  @Post()
  create(@Body() createFicheDto: CreateFicheDto) {
    console.log(
      '📥 Received fiche data:',
      JSON.stringify(createFicheDto, null, 2),
    );
    return this.fichesService.create(createFicheDto as any);
  }

  @Get()
  findAll(
    @Query('clientId') clientId?: string,
    @Query('startDate') startDate?: string,
    @Query('all') all?: string,
  ) {
    if (clientId) {
      return this.fichesService.findAllByClient(clientId, startDate);
    }
    if (all === 'true') {
      return this.fichesService.findAll(startDate);
    }
    return [];
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fichesService.findOne(id);
  }

  @Post(':id/email-order')
  async emailOrder(@Param('id') id: string) {
    console.log(`🔔 [FichesController] Received request to send email for Fiche ID: ${id}`);
    return this.fichesService.sendOrderEmail(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateFicheDto: UpdateFicheDto) {
    return this.fichesService.update(id, updateFicheDto as any);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fichesService.remove(id);
  }
}
