import { Module } from "@nestjs/common";
import { VerreBrandController } from "./verre-brand.controller";
import { VerreBrandService } from "./verre-brand.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [VerreBrandController],
  providers: [VerreBrandService],
  exports: [VerreBrandService],
})
export class VerreBrandModule {}
