import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MarketingConfigService {
    private readonly logger = new Logger(MarketingConfigService.name);

    constructor(private prisma: PrismaService) { }

    async getConfig() {
        let config = await this.prisma.marketingConfig.findFirst();
        if (!config) {
            // Create a default one if it doesn't exist
            config = await this.prisma.marketingConfig.create({
                data: {
                    smtpPort: 587
                }
            });
        }
        return config;
    }

    async updateConfig(data: any) {
        const current = await this.getConfig();
        return this.prisma.marketingConfig.update({
            where: { id: current.id },
            data: {
                whatsappApiUrl: data.whatsappApiUrl,
                whatsappInstanceId: data.whatsappInstanceId,
                whatsappToken: data.whatsappToken,
                smsGatewayUrl: data.smsGatewayUrl,
                smsApiKey: data.smsApiKey,
                smtpHost: data.smtpHost,
                smtpPort: data.smtpPort ? parseInt(data.smtpPort.toString()) : 587,
                smtpUser: data.smtpUser,
                smtpPass: data.smtpPass,
                smtpFrom: data.smtpFrom
            }
        });
    }
}
