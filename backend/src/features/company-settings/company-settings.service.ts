import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompanySettingsService {
    constructor(private prisma: PrismaService) { }

    async getSettings() {
        let settings = await this.prisma.companySettings.findFirst();
        if (!settings) {
            // Create default settings if none exist
            settings = await this.prisma.companySettings.create({
                data: {
                    name: 'Ma Société',
                },
            });
        }
        return settings;
    }

    async updateSettings(data: any) {
        const settings = await this.getSettings();
        return this.prisma.companySettings.update({
            where: { id: settings.id },
            data,
        });
    }
}
