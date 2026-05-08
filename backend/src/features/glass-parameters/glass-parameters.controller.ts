import { Controller, Get, Post, Body, Delete, Param, Patch, Req } from '@nestjs/common';
import { GlassParametersService } from './glass-parameters.service';

@Controller('glass-parameters')
export class GlassParametersController {
  constructor(private readonly service: GlassParametersService) {
    console.log('🚀 GlassParametersController instantiated!');
  }

  @Get()
  test() {
    return { status: 'OK', message: 'GlassParametersController is active' };
  }

  @Get('all')
  getAll() {
    return this.service.getAllParameters();
  }

  @Get('seed')
  seed() {
    return this.service.seedInitialData();
  }

  // Brands
  @Post('brands')
  createBrand(@Body('name') name: string) {
    return this.service.createBrand(name);
  }

  @Delete('brands/:id')
  deleteBrand(@Param('id') id: string) {
    return this.service.deleteBrand(id);
  }

  // Materials
  @Post('materials')
  createMaterial(@Body('name') name: string) {
    return this.service.createMaterial(name);
  }

  @Delete('materials/:id')
  deleteMaterial(@Param('id') id: string) {
    return this.service.deleteMaterial(id);
  }

  // Indices
  @Post('indices')
  createIndex(
    @Body('materialId') materialId: string,
    @Body('value') value: string,
    @Body('label') label?: string,
    @Body('price') price?: number,
  ) {
    return this.service.createIndex(materialId, value, label, price);
  }

  @Patch('indices/:id')
  updateIndex(
    @Param('id') id: string,
    @Body() data: { value?: string; label?: string; price?: number },
  ) {
    return this.service.updateIndex(id, data);
  }

  @Delete('indices/:id')
  deleteIndex(@Param('id') id: string) {
    return this.service.deleteIndex(id);
  }

  // Treatments
  @Post('treatments')
  createTreatment(@Body('name') name: string, @Body('price') price?: number) {
    return this.service.createTreatment(name, price);
  }

  @Patch('treatments/:id')
  updateTreatment(@Param('id') id: string, @Body() data: { name?: string; price?: number }) {
    return this.service.updateTreatment(id, data);
  }

  @Delete('treatments/:id')
  deleteTreatment(@Param('id') id: string) {
    return this.service.deleteTreatment(id);
  }

  // Stock Management
  @Post('indices/:id/stock')
  updateIndexStock(
    @Param('id') id: string,
    @Body() body: { delta: number; motif: string },
    @Req() req: any,
  ) {
    return this.service.updateIndexStock(id, body.delta, body.motif, req.user?.id);
  }

  @Post('treatments/:id/stock')
  updateTreatmentStock(
    @Param('id') id: string,
    @Body() body: { delta: number; motif: string },
    @Req() req: any,
  ) {
    return this.service.updateTreatmentStock(id, body.delta, body.motif, req.user?.id);
  }

  @Get(':type/:id/history')
  getStockHistory(
    @Param('type') type: 'index' | 'treatment',
    @Param('id') id: string,
  ) {
    return this.service.getStockHistory(type, id);
  }
}
