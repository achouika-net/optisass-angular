import { Controller, Get, Patch, Body } from '@nestjs/common';
import { CompanySettingsService } from './company-settings.service';

@Controller('company-settings')
export class CompanySettingsController {
    constructor(private readonly service: CompanySettingsService) { }

    @Get()
    getSettings() {
        return this.service.getSettings();
    }

    @Patch()
    updateSettings(@Body() data: any) {
        return this.service.updateSettings(data);
    }
}
