import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { ClientsModule } from '../clients/clients.module';
import { ProductsModule } from '../products/products.module';
import { MarketingConfigService } from './marketing-config.service';

@Module({
    imports: [ClientsModule, ProductsModule],
    controllers: [MarketingController],
    providers: [MarketingService, MarketingConfigService],
})
export class MarketingModule { }
