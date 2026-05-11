import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
} from '@nestjs/common';
import { FichesService } from './fiches.service';
import { CreateFicheDto } from './dto/create-fiche.dto';
import { UpdateFicheDto } from './dto/update-fiche.dto';
import { Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Controller('fiches')
export class FichesController {
  constructor(
    private readonly fichesService: FichesService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  create(
    @Body() createFicheDto: CreateFicheDto,
    @Headers('authorization') authHeader: string,
  ) {
    console.log(
      '📥 Received fiche data:',
      JSON.stringify(createFicheDto, null, 2),
    );
    const userId = this.getUserId(authHeader);
    return this.fichesService.create(createFicheDto as any, userId);
  }

  @Get('bc-history')
  getBcHistory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.fichesService.findAllBcHistory({
      startDate,
      endDate,
      centreId,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
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
    console.log(
      `🔔 [FichesController] Received request to send email for Fiche ID: ${id}`,
    );
    return this.fichesService.sendOrderEmail(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateFicheDto: UpdateFicheDto,
    @Headers('authorization') authHeader: string,
  ) {
    const userId = this.getUserId(authHeader);
    return this.fichesService.update(id, updateFicheDto as any, userId);
  }

  private getUserId(authHeader: string): string | undefined {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
    try {
      const token = authHeader.split(' ')[1];
      const secret =
        this.configService.get<string>('JWT_SECRET') || 'your-very-secret-key';
      const payload = jwt.verify(token, secret) as any;
      return payload.sub;
    } catch (e) {
      return undefined;
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fichesService.remove(id);
  }
}
