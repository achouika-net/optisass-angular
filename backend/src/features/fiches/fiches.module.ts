import { Module } from '@nestjs/common';
import { FichesService } from './fiches.service';
import { FichesController } from './fiches.controller';

@Module({
    controllers: [FichesController],
    providers: [FichesService],
})
export class FichesModule { }
