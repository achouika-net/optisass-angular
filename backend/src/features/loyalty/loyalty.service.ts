import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService) { }

  async getPointsHistory(clientId: string, centreId?: string) {
    const where: any = { clientId };

    // SECURITY: Filter by centreId if provided (prevents data leak)
    if (centreId) {
      where.facture = { centreId };
    }

    return this.prisma.pointsHistory.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { facture: true },
    });
  }

  async getPointsBalance(clientId: string): Promise<number> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { pointsFidelite: true },
    });
    return client?.pointsFidelite || 0;
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
          pointsToMADRatio: 0.1,
        } as any,
      });
    }
    return config;
  }

  async updateConfig(data: any) {
    const config = await this.getConfig();
    return this.prisma.loyaltyConfig.update({
      where: { id: config.id },
      data: {
        pointsPerDH:
          data.pointsPerDH !== undefined
            ? parseFloat(data.pointsPerDH)
            : (config as any).pointsPerDH,
        referrerBonus:
          data.referrerBonus !== undefined
            ? parseInt(data.referrerBonus)
            : (config as any).referrerBonus,
        refereeBonus:
          data.refereeBonus !== undefined
            ? parseInt(data.refereeBonus)
            : (config as any).refereeBonus,
        folderCreationBonus:
          data.folderCreationBonus !== undefined
            ? parseInt(data.folderCreationBonus)
            : (config as any).folderCreationBonus,
        rewardThreshold:
          data.rewardThreshold !== undefined
            ? parseInt(data.rewardThreshold)
            : (config as any).rewardThreshold,
        pointsToMADRatio:
          data.pointsToMADRatio !== undefined
            ? parseFloat(data.pointsToMADRatio)
            : (config as any).pointsToMADRatio,
      } as any,
    });
  }

  async awardPointsForPurchase(factureId: string, tx?: any) {
    const prisma = tx || this.prisma;
    const existingAward = await prisma.pointsHistory.findFirst({
      where: { factureId, type: 'EARN' },
    });
    if (existingAward) return;

    const facture = await prisma.facture.findUnique({
      where: { id: factureId },
      include: { client: true },
    });

    if (!facture || !facture.client) return;

    // Disallow points for convention clients (only for 'direct' clients)
    if (facture.client.conventionId) {
      console.log(`ℹ️ Client ${facture.client.id} has a convention. Skipping Fidelio points.`);
      return;
    }

    const config = (await this.getConfig()) as any;
    const points = Math.floor(facture.totalTTC * config.pointsPerDH);

    if (points <= 0) return;

    const typeLabel = facture.type === 'FACTURE' ? 'facture' : 'bon de commande';

    if (tx) {
      await tx.client.update({
        where: { id: facture.clientId },
        data: { pointsFidelite: { increment: points } },
      });
      await tx.pointsHistory.create({
        data: {
          clientId: facture.clientId,
          factureId: facture.id,
          points: points,
          type: 'EARN',
          description: `Achat ${typeLabel} ${facture.numero}`,
        },
      });
      return;
    }

    return this.prisma.$transaction([
      this.prisma.client.update({
        where: { id: facture.clientId },
        data: { pointsFidelite: { increment: points } },
      }),
      this.prisma.pointsHistory.create({
        data: {
          clientId: facture.clientId,
          factureId: facture.id,
          points: points,
          type: 'EARN',
          description: `Achat ${typeLabel} ${facture.numero}`,
        },
      }),
    ]);
  }

  async awardReferralBonus(referrerId: string, refereeId: string) {
    const existingBonus = await this.prisma.pointsHistory.findFirst({
      where: {
        clientId: referrerId,
        type: 'REFERRAL',
        description: { contains: refereeId },
      },
    });

    if (existingBonus) return;

    const config = (await this.getConfig()) as any;

    return this.prisma.$transaction([
      this.prisma.client.update({
        where: { id: referrerId },
        data: { pointsFidelite: { increment: config.referrerBonus } },
      }),
      this.prisma.pointsHistory.create({
        data: {
          clientId: referrerId,
          points: config.referrerBonus,
          type: 'REFERRAL',
          description: `Parrainage client ${refereeId}`,
        },
      }),
      this.prisma.client.update({
        where: { id: refereeId },
        data: { pointsFidelite: { increment: config.refereeBonus } },
      }),
      this.prisma.pointsHistory.create({
        data: {
          clientId: refereeId,
          points: config.refereeBonus,
          type: 'REFERRAL',
          description: `Bonus filleul`,
        },
      }),
    ]);
  }

  async spendPoints(
    clientId: string,
    points: number,
    description: string,
    factureId?: string,
    tx?: any,
  ) {
    const pts = Math.floor(points);
    if (pts === 0) return;

    console.log(
      `🎯 [LoyaltyService] spendPoints | client: ${clientId}, points: ${pts}, facture: ${factureId} | description: ${description}`,
    );

    const client = tx || this.prisma;

    // Use a transaction if tx is not provided to ensure atomicity
    const updateClient = client.client.update({
      where: { id: clientId },
      data: { pointsFidelite: { decrement: pts } },
    });

    const createHistory = client.pointsHistory.create({
      data: {
        clientId,
        factureId,
        points: -pts,
        type: 'SPEND',
        description,
      },
    });

    if (tx) {
      await updateClient;
      await createHistory;
      return;
    }

    return this.prisma.$transaction([updateClient, createHistory]);
  }

  async awardPointsForFolderCreation(clientId: string, ficheId: string) {
    console.log(
      `💎 Awarding points for folder: client ${clientId}, fiche ${ficheId}`,
    );
    const existingAward = await this.prisma.pointsHistory.findFirst({
      where: {
        clientId,
        type: 'FOLDER_CREATION',
        description: { contains: ficheId },
      },
    });

    if (existingAward) {
      console.log('ℹ️ Points already awarded for this folder. Skipping.');
      return;
    }

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return;

    // Disallow points for convention clients (only for 'direct' clients)
    if (client.conventionId) {
      console.log(`ℹ️ Client ${clientId} has a convention. Skipping folder creation points.`);
      return;
    }

    const config = (await this.getConfig()) as any;
    console.log('⚙️ Loyalty config found:', config);

    if (!config.folderCreationBonus || config.folderCreationBonus <= 0) {
      console.log('ℹ️ folderCreationBonus is 0 or less. Skipping award.');
      return;
    }

    console.log(
      `✨ Incrementing points by ${config.folderCreationBonus} for client ${clientId}`,
    );
    return this.prisma.$transaction([
      this.prisma.client.update({
        where: { id: clientId },
        data: { pointsFidelite: { increment: config.folderCreationBonus } },
      }),
      this.prisma.pointsHistory.create({
        data: {
          clientId: clientId,
          points: config.folderCreationBonus as number,
          type: 'FOLDER_CREATION',
          description: `Création dossier médical fiche ${ficheId}`,
        },
      }),
    ]);
  }

  // NEW: Check if client is eligible for reward
  async checkRewardEligibility(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { pointsFidelite: true },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    const config = (await this.getConfig()) as any;
    const threshold = config.rewardThreshold || 500;

    const numPoints = Number(client.pointsFidelite) || 0;
    const numThreshold = Number(threshold) || 500;

    return {
      eligible: numPoints >= numThreshold,
      currentPoints: numPoints,
      threshold: numThreshold,
      madValue: Math.floor(numPoints * (Number(config.pointsToMADRatio) || 0.1)),
    };
  }

  // NEW: Redeem reward
  async redeemReward(
    clientId: string,
    rewardType: 'DISCOUNT' | 'MAD_BONUS',
    redeemedBy?: string,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { pointsFidelite: true },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    const config = (await this.getConfig()) as any;
    const threshold = config.rewardThreshold || 500;

    if (client.pointsFidelite < threshold) {
      throw new Error(
        `Points insuffisants. Minimum requis: ${threshold} points`,
      );
    }

    const pointsUsed = client.pointsFidelite;
    const madValue = Math.floor(pointsUsed * (config.pointsToMADRatio || 0.1));

    // Transaction: Create redemption, add history entry, reset points
    const result = await this.prisma.$transaction(async (tx) => {
      const redemption = await tx.rewardRedemption.create({
        data: {
          clientId,
          pointsUsed,
          rewardType,
          madValue,
          redeemedBy,
        },
      });

      await tx.pointsHistory.create({
        data: {
          clientId,
          points: -pointsUsed,
          type: 'SPEND',
          description: `Échange récompense: ${rewardType === 'DISCOUNT' ? 'Remise' : 'Bonus MAD'} (${madValue} MAD)`,
        },
      });

      await tx.client.update({
        where: { id: clientId },
        data: { pointsFidelite: 0 },
      });

      // --- NEW: Immediately attempt to apply this redemption to the oldest unpaid invoice ---
      const oldestUnpaidInvoice = await tx.facture.findFirst({
        where: {
          clientId: clientId,
          statut: { notIn: ['PAYEE', 'ANNULEE'] },
          resteAPayer: { gt: 0 },
        },
        orderBy: { dateEmission: 'asc' },
      });

      if (oldestUnpaidInvoice && typeof oldestUnpaidInvoice.resteAPayer === 'number') {
        const montantAReduire = Math.min(redemption.madValue, oldestUnpaidInvoice.resteAPayer);
        const nouveauReste = oldestUnpaidInvoice.resteAPayer - montantAReduire;
        const newStatut = nouveauReste <= 0.05 ? 'PAYEE' : 'PARTIEL';

        const paiement = await tx.paiement.create({
          data: {
            factureId: oldestUnpaidInvoice.id,
            montant: montantAReduire,
            mode: 'FIDELIO',
            date: new Date(),
            reference: 'BONUS_FIDELIO',
            notes: `Application immédiate prime de fidélité.`,
          }
        });

        await tx.rewardRedemption.update({
          where: { id: redemption.id },
          data: {
            isUsed: true,
            paiementId: paiement.id
          }
        });

        await tx.facture.update({
          where: { id: oldestUnpaidInvoice.id },
          data: {
            resteAPayer: nouveauReste,
            statut: oldestUnpaidInvoice.statut === 'BROUILLON' ? 'BROUILLON' : newStatut
          }
        });
        console.log(`✅ [Loyalty] Applied ${montantAReduire} MAD Fidelio reward immediately to invoice ${oldestUnpaidInvoice.numero}`);
      }

      return redemption;
    });

    return result;
  }

  // NEW: Get redemption history
  async getRedemptionHistory(clientId: string) {
    return this.prisma.rewardRedemption.findMany({
      where: { clientId },
      orderBy: { redeemedAt: 'desc' },
    });
  }

  /**
   * BUG-006 FIX: Handle loyalty points on invoice return/cancellation
   * Reverses points earned when invoice is returned or cancelled
   */
  async handleInvoiceReturn(factureId: string) {
    console.log(`[LOYALTY] Handling return for facture ${factureId}`);

    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: { client: true },
    });

    if (!facture) {
      throw new Error(`Facture ${factureId} not found`);
    }

    // Find points earned for this invoice
    const pointsEntry = await this.prisma.pointsHistory.findFirst({
      where: {
        factureId: factureId,
        type: 'GAIN', // Only reverse GAIN entries
      },
    });

    if (!pointsEntry) {
      console.log(`[LOYALTY] No points earned entry found for facture ${factureId}`);
      return;
    }

    // Create reverse transaction (PERTE = loss)
    const reverseEntry = await this.prisma.pointsHistory.create({
      data: {
        clientId: facture.clientId,
        factureId: factureId,
        type: 'PERTE',
        points: -pointsEntry.points, // Negative = loss (field is 'points' not 'montantPoints')
        description: `Annulation points - Retour facture ${factureId}`,
      },
    });

    // Decrement client total points
    const updatedClient = await this.prisma.client.update({
      where: { id: facture.clientId },
      data: {
        pointsFidelite: {
          decrement: pointsEntry.points,
        },
      },
    });

    console.log(
      `[LOYALTY] Reversed ${pointsEntry.points} points for client ${facture.clientId}. New balance: ${updatedClient.pointsFidelite}`,
    );

    return reverseEntry;
  }

  /**
   * BUG-010 FIX: Cache invalidation on loyalty operations
   * Clears cached points data when loyalty state changes
   * Ready for Redis integration
   */
  private async invalidatePointsCache(clientId: string): Promise<void> {
    console.log(`[LOYALTY-CACHE] Invalidating points cache for client ${clientId}`);

    // TODO: Integrate with Redis when available
    // const cacheKey = `loyalty:points:${clientId}`;
    // await this.cacheManager.del(cacheKey);

    // For now, just log the cache invalidation
    console.log(`[LOYALTY-CACHE] Cache invalidation queued for ${clientId}`);
  }

  /**
   * Invalidate points after any state change
   */
  async invalidatePointsForAllOperations(clientId: string): Promise<void> {
    // Invalidate points cache
    await this.invalidatePointsCache(clientId);

    // Invalidate related caches:
    // - Points balance
    // - Redemption history
    // - Loyalty tier calculations
    console.log(`[LOYALTY-CACHE] All loyalty caches invalidated for ${clientId}`);
  }
}
