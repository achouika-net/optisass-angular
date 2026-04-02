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
  Headers,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  async create(
    @Body() createClientDto: CreateClientDto,
    @Headers('Tenant') centreId: string,
  ) {
    console.log(
      '📥 CREATE Incoming payload:',
      JSON.stringify(createClientDto, null, 2),
    );

    // Attach centreId if provided in headers
    if (centreId) {
      createClientDto.centreId = centreId;
    }

    try {
      console.log(
        '🔄 Processed CREATE DTO:',
        JSON.stringify(createClientDto, null, 2),
      );
      return await this.clientsService.create(createClientDto);
    } catch (error) {
      console.error('❌ CREATE CLIENT ERROR:', error);
      throw error;
    }
  }

  @Get()
  findAll(@Query('nom') nom?: string, @Headers('Tenant') centreId?: string) {
    return this.clientsService.findAll(nom, centreId);
  }

  @Get('search')
  search(
    @Query('typeClient') typeClient?: string,
    @Query('statut') statut?: string,
    @Query('nom') nom?: string,
    @Query('prenom') prenom?: string,
    @Query('telephone') telephone?: string,
    @Query('cin') cin?: string,
    @Query('groupeFamille') groupeFamille?: string,
    @Query('fidelioEligible') fidelioEligible?: string,
    @Headers('Tenant') centreId?: string,
  ) {
    return this.clientsService.search({
      typeClient,
      statut,
      nom,
      prenom,
      telephone,
      cin,
      groupeFamille,
      fidelioEligible,
      centreId,
    });
  }

  @Get(':id/summary')
  getSummary(@Param('id') id: string) {
    return this.clientsService.getSummary(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Put(':id')

  async update(
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    console.log(
      '📥 UPDATE Incoming payload:',
      JSON.stringify(updateClientDto, null, 2),
    );

    try {
      console.log(
        '🔄 Processed UPDATE DTO:',
        JSON.stringify(updateClientDto, null, 2),
      );
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
