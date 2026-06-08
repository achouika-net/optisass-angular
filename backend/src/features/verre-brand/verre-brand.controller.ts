import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Req
} from "@nestjs/common";
import { VerreBrandService } from "./verre-brand.service";
import { CreateVerreBrandDto, UpdateVerreBrandDto, AjusterStockDto } from "./dto/create-verre-brand.dto";

@Controller("verre-brand")
export class VerreBrandController {
  constructor(private readonly service: VerreBrandService) {}

  @Post()
  create(@Body() dto: CreateVerreBrandDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query("brandId") brandId?: string,
    @Query("glassIndexId") glassIndexId?: string,
    @Query("actif") actif?: string,
  ) {
    return this.service.findAll({
      brandId,
      glassIndexId,
      actif: actif !== undefined ? actif === "true" : undefined,
    });
  }

  @Get("by-glass/:glassIndexId")
  compareByGlassIndex(@Param("glassIndexId") glassIndexId: string) {
    return this.service.compareByGlassIndex(glassIndexId);
  }

  @Get("by-brand/:brandId")
  findByBrand(@Param("brandId") brandId: string) {
    return this.service.findByBrand(brandId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateVerreBrandDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post("recalc-marge/:brandId")
  recalcMarge(
    @Param("brandId") brandId: string,
    @Body("marge") marge: number,
  ) {
    return this.service.recalcPrixVenteForBrand(brandId, marge);
  }

  @Post(":id/stock")
  ajusterStock(
    @Param("id") id: string,
    @Body() dto: AjusterStockDto,
    @Req() req,
  ) {
    const userId = req.user?.id;
    return this.service.ajusterStock(id, dto.delta, dto.motif, userId);
  }

  @Get(":id/history")
  getHistoriqueStock(@Param("id") id: string) {
    return this.service.getHistoriqueStock(id);
  }
}
