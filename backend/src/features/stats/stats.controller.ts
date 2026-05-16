import { Controller, Get, Query, Headers } from '@nestjs/common';
import { StatsService } from './stats.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('stats')
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('diag-data')
  async diagData() {
    const [pCount, pSum, fCount, fSum] = await Promise.all([
      this.prisma.paiement.count(),
      this.prisma.paiement.aggregate({ _sum: { montant: true } }),
      this.prisma.facture.count(),
      this.prisma.facture.aggregate({ _sum: { totalHT: true } }),
    ]);
    return {
      payments: { count: pCount, sum: pSum._sum.montant },
      invoices: { count: fCount, sum: fSum._sum.totalHT },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('revenue-evolution')
  getRevenueEvolution(
    @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'monthly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getRevenueEvolution(
      period,
      startDate,
      endDate,
      centreId,
    );
  }

  @Get('product-distribution')
  getProductDistribution(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getProductDistribution(
      startDate,
      endDate,
      centreId,
    );
  }

  @Get('conversion-rate')
  getConversionRate(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getConversionRate(startDate, endDate, centreId);
  }

  @Get('stock-by-warehouse')
  getStockByWarehouse(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getStockByWarehouse(startDate, endDate, centreId);
  }

  @Get('top-clients')
  getTopClients(
    @Query('limit') limit: number = 10,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getTopClients(
      +limit,
      startDate,
      endDate,
      centreId,
    );
  }

  @Get('payment-methods')
  getPaymentMethods(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getPaymentMethods(startDate, endDate, centreId);
  }

  @Get('summary')
  getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getSummary(startDate, endDate, centreId);
  }

  @Get('profit')
  getRealProfit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getRealProfit(startDate, endDate, centreId);
  }

  @Get('profit-evolution')
  getProfitEvolution(
    @Query('period') period: 'daily' | 'monthly' = 'monthly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getProfitEvolution(
      period,
      startDate,
      endDate,
      centreId,
    );
  }

  @Get('revenue-details')
  getRevenueDetails(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getRevenueDetails(startDate, endDate, centreId);
  }

  @Get('expense-details')
  getExpenseDetails(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getExpenseDetails(startDate, endDate, centreId);
  }

  @Get('product-sales-details-v2')
  getProductSalesDetails(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.statsService.getProductSalesDetailsV2(
      startDate,
      endDate,
      centreId,
    );
  }

  /** Diagnostic endpoint - check purchase prices of sold products
   *  GET /stats/diag-prix-achat?startDate=2026-05-01&endDate=2026-05-31
   */
  @Get('diag-prix-achat')
  async diagPrixAchat(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    const factures = await (this.prisma as any).facture.findMany({
      where: {
        dateEmission: { gte: start, lte: end },
        statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
        type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM'] },
      },
      include: {
        mouvementsStock: { include: { produit: true } },
      },
    });

    const report: any[] = [];
    let lignesAvecProduitId = 0;
    let lignesSansProduitId = 0;

    for (const f of factures) {
      const lines = (f.lignes as any[]) || [];
      for (const line of lines) {
        if (!line.produitId) {
          lignesSansProduitId++;
          continue;
        }
        lignesAvecProduitId++;

        const mvt = (f.mouvementsStock || []).find(
          (m: any) => m.produitId === line.produitId,
        );

        report.push({
          factureId: f.id,
          factureNumero: f.numero,
          produitId: line.produitId,
          typeArticle: line.typeArticle || '?',
          marque: line.marque || '?',
          qty: line.qte ?? line.quantite ?? 1,
          // From invoice line itself
          prixLigneUnitaire:
            line.prixUnitaireHT ?? line.prixUnitaireTTC ?? null,
          // From stock movement
          mvtExiste: !!mvt,
          mvtPrixAchatUnitaire: mvt?.prixAchatUnitaire ?? null,
          // From product catalog (via movement relation)
          catalogPrixAchatHT: mvt?.produit?.prixAchatHT ?? null,
          // Diagnosis
          diagnostic: !mvt
            ? '❌ Aucun mouvement de stock lié à cette facture pour ce produit'
            : mvt.prixAchatUnitaire > 0
              ? '✅ Prix mouvement OK'
              : mvt.produit?.prixAchatHT > 0
                ? '⚠️ Mouvement sans prix, mais catalogue OK → notre fallback devrait marcher'
                : '🔴 Prix = 0 dans mouvement ET dans catalogue → donnée manquante en base',
        });
      }
    }

    const zeros = report.filter(
      (r) =>
        (r.mvtPrixAchatUnitaire ?? 0) === 0 &&
        (r.catalogPrixAchatHT ?? 0) === 0,
    );
    const fallbackOk = report.filter(
      (r) =>
        (r.mvtPrixAchatUnitaire ?? 0) === 0 && (r.catalogPrixAchatHT ?? 0) > 0,
    );
    const noMvt = report.filter((r) => !r.mvtExiste);

    return {
      periode: { start, end },
      factures: factures.length,
      lignesAvecProduitId,
      lignesSansProduitId,
      resume: {
        total: report.length,
        ok: report.length - zeros.length - fallbackOk.length - noMvt.length,
        fallbackNeeded: fallbackOk.length,
        prixZeroEnBase: zeros.length,
        sansMouvement: noMvt.length,
      },
      details: report,
    };
  }
}
