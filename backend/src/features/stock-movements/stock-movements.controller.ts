import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  Headers,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { StockMovementsService } from './stock-movements.service';
import { BulkAlimentationDto } from './dto/bulk-alimentation.dto';

@Controller('stock-movements')
export class StockMovementsController {
  constructor(
    private readonly service: StockMovementsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('bulk-alimentation')
  bulkAlimentation(
    @Body() dto: BulkAlimentationDto,
    @Headers('authorization') authHeader: string,
  ) {
    // Always use the authenticated user from JWT, overriding any client-provided userId
    const jwtUserId = this.getUserId(authHeader);
    if (jwtUserId) {
      dto.userId = jwtUserId;
    }
    return this.service.processBulkAlimentation(dto);
  }

  @Get('product/:productId')
  findAllByProduct(@Param('productId') productId: string) {
    return this.service.findAllByProduct(productId);
  }

  @Get('history')
  getHistory(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('supplierId') supplierId?: string,
    @Query('docType') docType?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.service.getHistory({
      dateFrom,
      dateTo,
      supplierId,
      docType,
      centreId,
    });
  }

  @Get('out-history')
  getOutHistory(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.service.getOutHistory({ dateFrom, dateTo, search, centreId });
  }

  @Get('debug-data')
  debugData() {
    return this.service.debugData();
  }

  @Delete('history/:id')
  deleteHistory(@Param('id') id: string) {
    return this.service.removeEntryHistory(id);
  }

  private getUserId(authHeader: string): string | undefined {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
    try {
      const token = authHeader.split(' ')[1];
      const secret =
        this.configService.get<string>('JWT_SECRET') || 'your-very-secret-key';
      const payload = jwt.verify(token, secret) as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return payload.sub as string;
    } catch {
      return undefined;
    }
  }
}
