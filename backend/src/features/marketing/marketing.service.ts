import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { MarketingConfigService } from './marketing-config.service';

@Injectable()
export class MarketingService {
    private readonly logger = new Logger(MarketingService.name);

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private marketingConfigService: MarketingConfigService
    ) { }

    async getMarketingConfig() {
        return this.marketingConfigService.getConfig();
    }

    async updateMarketingConfig(data: any) {
        return this.marketingConfigService.updateConfig(data);
    }

    async processCampaign(data: {
        clientIds: string[],
        productIds: string[],
        template: string,
        promoName?: string,
        promoDescription?: string,
        channel?: 'WHATSAPP' | 'SMS' | 'EMAIL'
    }) {
        const { clientIds, productIds, template, promoName, promoDescription, channel = 'WHATSAPP' } = data;
        const config = await this.marketingConfigService.getConfig();

        // 1. Fetch data
        const clients = await this.prisma.client.findMany({
            where: { id: { in: clientIds } }
        });

        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } }
        });

        // 2. Prepare messages
        const campaignResults: any[] = [];
        const productMarques = products.map(p => p.marque || '').filter((v, i, a) => v && a.indexOf(v) === i).join(', ');
        const productNames = products.map(p => p.designation).join(', ');

        for (const client of clients) {
            let message = template
                .replace(/{{NAME}}/g, (client as any).raisonSociale || `${client.nom || ''} ${client.prenom || ''}`.trim())
                .replace(/{{MARQUE}}/g, productMarques)
                .replace(/{{PRODUCT}}/g, productNames)
                .replace(/{{PROMO_NAME}}/g, promoName || '')
                .replace(/{{DESCRIPTION}}/g, promoDescription || '');

            const formattedPhone = client.telephone ? this.formatPhone(client.telephone) : '';

            try {
                // 3. Routing based on channel
                if (channel === 'WHATSAPP' && formattedPhone) {
                    await this.sendWhatsApp(formattedPhone, message, config);
                } else if (channel === 'SMS' && client.telephone) {
                    await this.sendSMS(client.telephone, message, config);
                } else if (channel === 'EMAIL' && (client as any).email) {
                    await this.sendEmail((client as any).email, `Offre Spéciale: ${promoName || 'Votre promotion'}`, message, config);
                } else {
                    this.logger.warn(`[CAMPAIGN] Skipping client ${client.id} - No valid ${channel} contact info`);
                    continue;
                }

                campaignResults.push({ clientId: client.id, channel, status: 'SENT' });
            } catch (error) {
                this.logger.error(`[CAMPAIGN] Failed to send to ${client.id} via ${channel}: ${error.message}`);
                campaignResults.push({ clientId: client.id, channel, status: 'FAILED', error: error.message });
            }
        }

        return {
            success: true,
            processedCount: campaignResults.length,
            channel,
            results: campaignResults
        };
    }

    private async sendWhatsApp(phone: string, message: string, dbConfig?: any) {
        const apiUrl = dbConfig?.whatsappApiUrl || this.configService.get<string>('WHATSAPP_API_URL');
        const token = dbConfig?.whatsappToken || this.configService.get<string>('WHATSAPP_TOKEN');
        const instanceId = dbConfig?.whatsappInstanceId || this.configService.get<string>('WHATSAPP_INSTANCE_ID');

        this.logger.log(`[WhatsApp] Attempting send to ${phone} via ${apiUrl}`);

        if (!apiUrl || !token || !instanceId) {
            this.logger.warn('[WhatsApp] API credentials missing, skipping send.');
            return;
        }

        const url = `${apiUrl}/${instanceId}/messages/chat`;
        try {
            const response = await axios.post(url, {
                token: token,
                to: phone,
                body: message
            });
            this.logger.log(`[WhatsApp] Send successful for ${phone}: ${JSON.stringify(response.data)}`);
        } catch (error) {
            this.logger.error(`[WhatsApp] Failed to send to ${phone}: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
            throw error;
        }
    }

    private async sendSMS(phone: string, message: string, dbConfig?: any) {
        const apiUrl = dbConfig?.smsGatewayUrl || this.configService.get<string>('SMS_GATEWAY_URL');
        const apiKey = dbConfig?.smsApiKey || this.configService.get<string>('SMS_API_KEY');

        this.logger.log(`[SMS] Attempting send to ${phone} via ${apiUrl}`);

        if (!apiUrl || !apiKey) {
            this.logger.warn('[SMS] API credentials missing, skipping send.');
            return;
        }

        try {
            const response = await axios.post(apiUrl, {
                apiKey: apiKey,
                to: phone,
                message: message
            });
            this.logger.log(`[SMS] Send successful for ${phone}: ${JSON.stringify(response.data)}`);
        } catch (error) {
            this.logger.error(`[SMS] Failed to send to ${phone}: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
            throw error;
        }
    }

    private async sendEmail(to: string, subject: string, body: string, dbConfig?: any) {
        const host = dbConfig?.smtpHost || this.configService.get<string>('SMTP_HOST');
        const user = dbConfig?.smtpUser || this.configService.get<string>('SMTP_USER');
        const pass = dbConfig?.smtpPass || this.configService.get<string>('SMTP_PASS');
        const port = Number(dbConfig?.smtpPort) || this.configService.get<number>('SMTP_PORT', 587);

        this.logger.log(`[Email] Attempting send to ${to} via ${host}:${port} (user: ${user})`);

        if (!host || !user || !pass) {
            this.logger.warn('[Email] SMTP credentials missing, skipping send.');
            return;
        }

        try {
            const transporter = nodemailer.createTransport({
                host: host,
                port: port,
                secure: port === 465, // true for 465, false for other ports
                auth: { user, pass },
                tls: {
                    // Do not fail on invalid certs
                    rejectUnauthorized: false
                }
            });

            const info = await transporter.sendMail({
                from: dbConfig?.smtpFrom || this.configService.get<string>('SMTP_FROM', user),
                to,
                subject,
                text: body,
                html: `<div style="font-family: sans-serif; padding: 20px;">
                        ${body.replace(/\n/g, '<br>')}
                       </div>`
            });
            this.logger.log(`[Email] Send successful to ${to}: ${info.messageId}`);
        } catch (error) {
            this.logger.error(`[Email] Failed to send to ${to}: ${error.message}`);
            throw error;
        }
    }

    async getStats() {
        const oldStockCount = await this.prisma.product.count({
            where: {
                quantiteActuelle: { gt: 0 },
                createdAt: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } // 6 months+
            }
        });

        return {
            oldStockCount,
            totalClients: await this.prisma.client.count()
        };
    }

    private formatPhone(phone: string): string {
        let clean = phone.replace(/[^0-9]/g, '');
        if (clean.startsWith('0') && clean.length === 10) {
            return '212' + clean.substring(1);
        }
        return clean;
    }
}
