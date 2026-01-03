import { Controller, Post, Body, Get } from '@nestjs/common';
import { MarketingService } from './marketing.service';

@Controller('marketing')
export class MarketingController {
    constructor(private readonly marketingService: MarketingService) { }

    @Post('campaign/launch')
    async launchCampaign(@Body() campaignData: {
        clientIds: string[],
        productIds: string[],
        template: string,
        promoName?: string,
        promoDescription?: string,
        channel?: 'WHATSAPP' | 'SMS' | 'EMAIL'
    }) {
        return this.marketingService.processCampaign(campaignData);
    }

    @Get('stats')
    async getMarketingStats() {
        return this.marketingService.getStats();
    }

    @Get('config')
    async getConfig() {
        return this.marketingService.getMarketingConfig();
    }

    @Post('config')
    async updateConfig(@Body() data: any) {
        return this.marketingService.updateMarketingConfig(data);
    }
}
