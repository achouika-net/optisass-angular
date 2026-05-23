import { ReleveParserService } from './releve-parser.service';
import { Module } from '@nestjs/common';
import { BanqueController } from './banque.controller';
import { BanqueService } from './banque.service';

@Module({
  controllers: [BanqueController],
  providers: [BanqueService, ReleveParserService]
})
export class BanqueModule {}
