import { Module } from '@nestjs/common';
import { CompanySettingsService } from './company-settings.service';
import { CompanySettingsController } from './company-settings.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [CompanySettingsController],
    providers: [CompanySettingsService],
    exports: [CompanySettingsService],
})
export class CompanySettingsModule { }
