import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LoyaltyService {
    constructor(private prisma: PrismaService) { }

    async getPointsHistory(clientId: string) {
        return this.prisma.pointsHistory.findMany({
            where: { clientId },
            orderBy: { date: 'desc' },
            include: { facture: true }
        });
    }

    async getConfig() {
        let config = await this.prisma.loyaltyConfig.findFirst();
        if (!config) {
            config = await this.prisma.loyaltyConfig.create({
                data: {
                    pointsPerDH: 0.1,
                    referrerBonus: 50,
                    refereeBonus: 20,
                    folderCreationBonus: 30,
                    rewardThreshold: 500,
                    pointsToMADRatio: 0.1
                } as any
            });
        }
        return config;
    }

    async updateConfig(data: any) {
        const config = await this.getConfig();
        return this.prisma.loyaltyConfig.update({
            where: { id: config.id },
            data: {
                pointsPerDH: data.pointsPerDH !== undefined ? parseFloat(data.pointsPerDH) : (config as any).pointsPerDH,
                referrerBonus: data.referrerBonus !== undefined ? parseInt(data.referrerBonus) : (config as any).referrerBonus,
                refereeBonus: data.refereeBonus !== undefined ? parseInt(data.refereeBonus) : (config as any).refereeBonus,
                folderCreationBonus: data.folderCreationBonus !== undefined ? parseInt(data.folderCreationBonus) : (config as any).folderCreationBonus,
                rewardThreshold: data.rewardThreshold !== undefined ? parseInt(data.rewardThreshold) : (config as any).rewardThreshold,
                pointsToMADRatio: data.pointsToMADRatio !== undefined ? parseFloat(data.pointsToMADRatio) : (config as any).pointsToMADRatio
            } as any
        });
    }

    async awardPointsForPurchase(factureId: string) {
        const existingAward = await this.prisma.pointsHistory.findFirst({
            where: { factureId, type: 'EARN' }
        });
        if (existingAward) return;

        const facture = await this.prisma.facture.findUnique({
            where: { id: factureId },
            include: { client: true }
        });

        if (!facture || !facture.client) return;

        const config = await this.getConfig() as any;
        const points = Math.floor(facture.totalTTC * config.pointsPerDH);

        if (points <= 0) return;

        return this.prisma.$transaction([
            this.prisma.client.update({
                where: { id: facture.clientId as string },
                data: { pointsFidelite: { increment: points } }
            }),
            this.prisma.pointsHistory.create({
                data: {
                    clientId: facture.clientId as string,
                    factureId: facture.id,
                    points: points,
                    type: 'EARN',
                    description: `Achat facture ${facture.numero}`
                }
            })
        ]);
    }

    async awardReferralBonus(referrerId: string, refereeId: string) {
        const existingBonus = await this.prisma.pointsHistory.findFirst({
            where: {
                clientId: referrerId,
                type: 'REFERRAL',
                description: { contains: refereeId }
            }
        });

        if (existingBonus) return;

        const config = await this.getConfig() as any;

        return this.prisma.$transaction([
            this.prisma.client.update({
                where: { id: referrerId },
                data: { pointsFidelite: { increment: config.referrerBonus } }
            }),
            this.prisma.pointsHistory.create({
                data: {
                    clientId: referrerId,
                    points: config.referrerBonus,
                    type: 'REFERRAL',
                    description: `Parrainage client ${refereeId}`
                }
            }),
            this.prisma.client.update({
                where: { id: refereeId },
                data: { pointsFidelite: { increment: config.refereeBonus } }
            }),
            this.prisma.pointsHistory.create({
                data: {
                    clientId: refereeId,
                    points: config.refereeBonus,
                    type: 'REFERRAL',
                    description: `Bonus filleul`
                }
            })
        ]);
    }

    async spendPoints(clientId: string, points: number, description: string, factureId?: string) {
        const client = await this.prisma.client.findUnique({
            where: { id: clientId }
        });

        if (!client || client.pointsFidelite < points) {
            throw new Error('Points insuffisants');
        }

        return this.prisma.$transaction([
            this.prisma.client.update({
                where: { id: clientId },
                data: { pointsFidelite: { decrement: points } }
            }),
            this.prisma.pointsHistory.create({
                data: {
                    clientId,
                    factureId,
                    points: -points,
                    type: 'SPEND',
                    description
                }
            })
        ]);
    }

    async awardPointsForFolderCreation(clientId: string, ficheId: string) {
        console.log(`💎 Awarding points for folder: client ${clientId}, fiche ${ficheId}`);
        const existingAward = await this.prisma.pointsHistory.findFirst({
            where: { clientId, type: 'FOLDER_CREATION', description: { contains: ficheId } }
        });

        if (existingAward) {
            console.log('ℹ️ Points already awarded for this folder. Skipping.');
            return;
        }

        const config = await this.getConfig() as any;
        console.log('⚙️ Loyalty config found:', config);

        if (!config.folderCreationBonus || config.folderCreationBonus <= 0) {
            console.log('ℹ️ folderCreationBonus is 0 or less. Skipping award.');
            return;
        }

        console.log(`✨ Incrementing points by ${config.folderCreationBonus} for client ${clientId}`);
        return this.prisma.$transaction([
            this.prisma.client.update({
                where: { id: clientId },
                data: { pointsFidelite: { increment: config.folderCreationBonus } }
            }),
            this.prisma.pointsHistory.create({
                data: {
                    clientId: clientId,
                    points: config.folderCreationBonus as number,
                    type: 'FOLDER_CREATION',
                    description: `Création dossier médical fiche ${ficheId}`
                }
            })
        ]);
    }

    // NEW: Check if client is eligible for reward
    async checkRewardEligibility(clientId: string) {
        const client = await this.prisma.client.findUnique({
            where: { id: clientId },
            select: { pointsFidelite: true }
        });

        if (!client) {
            throw new Error('Client not found');
        }

        const config = await this.getConfig() as any;
        const threshold = config.rewardThreshold || 500;

        return {
            eligible: client.pointsFidelite >= threshold,
            currentPoints: client.pointsFidelite,
            threshold: threshold,
            madValue: Math.floor(client.pointsFidelite * (config.pointsToMADRatio || 0.1))
        };
    }

    // NEW: Redeem reward
    async redeemReward(clientId: string, rewardType: 'DISCOUNT' | 'MAD_BONUS', redeemedBy?: string) {
        const client = await this.prisma.client.findUnique({
            where: { id: clientId },
            select: { pointsFidelite: true }
        });

        if (!client) {
            throw new Error('Client not found');
        }

        const config = await this.getConfig() as any;
        const threshold = config.rewardThreshold || 500;

        if (client.pointsFidelite < threshold) {
            throw new Error(`Points insuffisants. Minimum requis: ${threshold} points`);
        }

        const pointsUsed = client.pointsFidelite;
        const madValue = Math.floor(pointsUsed * (config.pointsToMADRatio || 0.1));

        // Transaction: Create redemption, add history entry, reset points
        const result = await this.prisma.$transaction([
            this.prisma.rewardRedemption.create({
                data: {
                    clientId,
                    pointsUsed,
                    rewardType,
                    madValue,
                    redeemedBy
                }
            }),
            this.prisma.pointsHistory.create({
                data: {
                    clientId,
                    points: -pointsUsed,
                    type: 'SPEND',
                    description: `Échange récompense: ${rewardType === 'DISCOUNT' ? 'Remise' : 'Bonus MAD'} (${madValue} MAD)`
                }
            }),
            this.prisma.client.update({
                where: { id: clientId },
                data: { pointsFidelite: 0 }
            })
        ]);

        return result[0]; // Return the redemption record
    }

    // NEW: Get redemption history
    async getRedemptionHistory(clientId: string) {
        return this.prisma.rewardRedemption.findMany({
            where: { clientId },
            orderBy: { redeemedAt: 'desc' }
        });
    }
}
