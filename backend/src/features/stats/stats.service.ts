import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RevenueDataPoint {
  period: string;
  revenue: number;
  count: number;
}

export interface ProductDistribution {
  type: string;
  count: number;
  value: number;
}

export interface ConversionMetrics {
  totalDevis: number;
  validatedFactures: number;
  paidFactures: number;
  conversionToFacture: number;
  conversionToPaid: number;
}

export interface WarehouseStock {
  warehouseName: string;
  totalQuantity: number;
  totalValue: number;
  productCount: number;
  breakdown: { type: string; quantity: number; value: number }[];
}

export interface TopClient {
  clientId: string;
  clientName: string;
  totalRevenue: number;
  invoiceCount: number;
}

export interface PaymentMethodStat {
  method: string;
  count: number;
  totalAmount: number;
}

@Injectable()
export class StatsService {
  private readonly INVENTORY_PURCHASE_TYPES = [
    'ACHAT VERRES OPTIQUES',
    'ACHAT_VERRE_OPTIQUE',
    'ACHAT_VERRES_OPTIQUES',
    'ACHAT VERRE OPTIQUE',
    'ACHAT_VERRE_OPTIQUES',
    'ACHAT MONTURES OPTIQUES',
    'ACHAT_MONTURE_OPTIQUE',
    'ACHAT_MONTURES_OPTIQUES',
    'ACHAT MONTURE OPTIQUE',
    'ACHAT LENTILLES DE CONTACT',
    'ACHAT_LENTILLES',
    'ACHAT_LENTILLES_DE_CONTACT',
    'ACHAT LENTILLES',
    'ACHAT ACCESSOIRES OPTIQUES',
    'ACHAT_ACCESSOIRES',
    'ACHAT_ACCESSOIRES_OPTIQUES',
    'ACHAT ACCESSOIRES',
    'ACHAT_STOCK',
    'ACHAT STOCK',
    'ACHAT_STOCK_DIVERS',
  ];

  private readonly OPERATIONAL_PURCHASE_TYPES = [
    'ELECTRICITE',
    'ÉLECTRICITÉ',
    'INTERNET',
    'ASSURANCE',
    'FRAIS BANCAIRES',
    'AUTRES CHARGES',
    'REGLEMENT CONSOMMATION EAU',
    'REGLEMENT SALAIRS OPTIQUES',
    'LOYER',
    'FRAIS_GENERAUX',
    'FRAIS GENERAUX',
    'AUTRES',
    'AUTRES FRAIS',
  ];

  private readonly ACTIVE_STATUSES = [
    'VALIDE',
    'VALIDEE',
    'VALIDÉ',
    'VALIDÉE',
    'PAYEE',
    'PAYÉ',
    'PAYÉE',
    'SOLDEE',
    'SOLDÉ',
    'SOLDÉE',
    'ENCAISSE',
    'ENCAISSÉ',
    'ENCAISSÉE',
    'PARTIEL',
    'BROUILLON',
    'ANNULEE',
  ];

  constructor(private prisma: PrismaService) {}

  private async getFilteredSales(
    start: Date,
    end: Date,
    centreFilter: any,
    includeRelations: any = false,
  ) {
    const facturesRaw = (await this.prisma.facture.findMany({
      where: {
        dateEmission: { gte: start, lte: end },
        statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
        type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR'] },
        ...centreFilter,
      },
      include:
        includeRelations === true
          ? {
              fiche: {
                include: { bonsLivraison: { include: { fournisseur: true } } },
              },
              mouvementsStock: { include: { produit: true } },
            }
          : includeRelations || undefined,
    })) as any[];

    const facturesWithFicheIds = new Set(
      facturesRaw
        .filter((f) => f.type === 'FACTURE' && f.ficheId)
        .map((f) => f.ficheId),
    );

    return facturesRaw.filter((f) => {
      const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM';
      const isFacturedViaFiche =
        isBC && f.ficheId && facturesWithFicheIds.has(f.ficheId);
      const isFacturedViaNote = isBC && f.notes?.includes('Remplacée par');
      return !(isFacturedViaFiche || isFacturedViaNote);
    });
  }

  async getRevenueEvolution(
    period: 'daily' | 'monthly' | 'yearly',
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ): Promise<RevenueDataPoint[]> {
    const isValidDate = (d: string | undefined | null): boolean =>
      !!(d && d !== 'undefined' && d !== 'null' && d !== '');

    let start = isValidDate(startDate) ? new Date(startDate!) : undefined;
    let end = isValidDate(endDate) ? new Date(endDate!) : undefined;

    if (!start || !end) {
      const range = await this.prisma.facture.aggregate({
        where: {
          centreId: centreId || undefined,
          statut: { notIn: ['ARCHIVE'] },
          type: {
            in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR', 'DEVIS'],
          },
        },
        _min: { dateEmission: true },
        _max: { dateEmission: true },
      });
      if (!start) start = range._min.dateEmission || new Date(2024, 0, 1);
      if (!end) end = range._max.dateEmission || new Date();
    }

    const centreFilter = centreId ? { centreId } : {};
    const factures = await this.getFilteredSales(start, end, centreFilter);

    const grouped = new Map<string, { revenue: number; count: number }>();

    // Helper to format date keys
    const formatKey = (date: Date) => {
      switch (period) {
        case 'daily':
          return date.toISOString().split('T')[0];
        case 'yearly':
          return date.getFullYear().toString();
        case 'monthly':
        default:
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
    };

    // Fill gaps
    const current = new Date(start);
    while (current <= end) {
      grouped.set(formatKey(current), { revenue: 0, count: 0 });
      if (period === 'daily') current.setDate(current.getDate() + 1);
      else if (period === 'monthly') current.setMonth(current.getMonth() + 1);
      else current.setFullYear(current.getFullYear() + 1);
    }

    factures.forEach((f) => {
      const date = new Date(f.dateEmission);
      const key = formatKey(date);

      const existing = grouped.get(key) || { revenue: 0, count: 0 };
      const amount = f.totalTTC || 0;
      const adjustedRevenue =
        f.type === 'AVOIR'
          ? existing.revenue - amount
          : existing.revenue + amount;

      grouped.set(key, {
        revenue: adjustedRevenue,
        count: existing.count + (f.type === 'AVOIR' ? 0 : 1),
      });
    });

    return Array.from(grouped.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }
  async getProductDistribution(
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ): Promise<ProductDistribution[]> {
    const isValidDate = (d: string | undefined | null): boolean =>
      !!(d && d !== 'undefined' && d !== 'null' && d !== '');
    const start = isValidDate(startDate) ? new Date(startDate!) : new Date(0);
    const end = isValidDate(endDate)
      ? new Date(endDate!)
      : new Date(3000, 0, 1);

    // Get sales (Facture lines) distribution
    const factures = await this.prisma.facture.findMany({
      where: {
        dateEmission: { gte: start, lte: end },
        centreId: centreId || undefined,
        statut: { notIn: ['ARCHIVE'] },
        type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'DEVIS'] }, // Exclude Avoirs from distribution counts
      },
      select: {
        lignes: true,
        fiche: { select: { type: true } },
      },
    });

    const distribution = new Map<string, { count: number; value: number }>();

    factures.forEach((f) => {
      const lines = (f.lignes as any[]) || [];
      if (lines.length > 0) {
        lines.forEach((l) => {
          // Support both imported lines (qte, prixUnitaireTTC) and regular lines (quantite, prixUnitaireHT)
          const qty = l.qte ?? l.quantite ?? 0;
          const price = l.prixUnitaireHT ?? l.prixUnitaireTTC ?? 0;
          const lineTotal = l.totalHT ?? l.totalTTC ?? qty * price;

          // Use typeArticle if set, otherwise infer from fiche type or description
          let type = l.typeArticle;
          if (!type && l.description) {
            const desc = String(l.description).toLowerCase();
            if (desc.includes('verre') || desc.includes('verres'))
              type = 'VERRE';
            else if (desc.includes('monture')) type = 'MONTURE';
            else if (desc.includes('lentille')) type = 'LENTILLES';
            else if (desc.includes('produit') || desc.includes('accessoire'))
              type = 'ACCESSOIRE';
          }
          if (!type && f.fiche?.type) {
            // Map fiche type to article category
            const ficheType = f.fiche.type.toLowerCase();
            if (ficheType === 'monture') type = 'MONTURE';
            else if (ficheType === 'lentilles') type = 'LENTILLES';
          }
          if (!type) type = 'NON_DÉFINI';

          type = this.normalizeProductType(type);

          const existing = distribution.get(type) || { count: 0, value: 0 };
          distribution.set(type, {
            count: existing.count + qty,
            value: existing.value + lineTotal,
          });
        });
      } else if (f.fiche && f.fiche.type) {
        // Fallback for fiches without any lines — count by fiche type
        const ficheType = f.fiche.type.toLowerCase();
        let type = 'NON_DÉFINI';
        if (ficheType === 'monture') type = 'MONTURE';
        else if (ficheType === 'lentilles') type = 'LENTILLES';

        const existing = distribution.get(type) || { count: 0, value: 0 };
        distribution.set(type, {
          count: existing.count + 1,
          value: existing.value,
        });
      }
    });

    return Array.from(distribution.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.value - a.value);
  }

  async getConversionRate(
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ): Promise<ConversionMetrics> {
    const isValidDate = (d: string | undefined | null): boolean =>
      !!(d && d !== 'undefined' && d !== 'null' && d !== '');
    const start = isValidDate(startDate) ? new Date(startDate!) : new Date(0);
    const end = isValidDate(endDate)
      ? new Date(endDate!)
      : new Date(3000, 0, 1);

    const whereClause = {
      dateEmission: { gte: start, lte: end },
      ...(centreId ? { centreId } : {}),
      statut: { notIn: ['ARCHIVE'] },
    };

    // Total ventes (toutes catégories confondues)
    const totalDevis = await this.prisma.facture.count({
      where: {
        ...whereClause,
        type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'DEVIS'] },
      },
    });

    // Ventes avec au moins un paiement = "converties"
    const validatedFactures = await this.prisma.facture.count({
      where: {
        ...whereClause,
        type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'DEVIS'] },
        paiements: { some: {} },
      },
    });

    // Ventes entièrement payées
    const paidFactures = await this.prisma.facture.count({
      where: {
        ...whereClause,
        OR: [
          { type: 'DEVIS' },
          { type: 'BON_COMMANDE' },
          { type: 'BON_COMM' },
          { type: 'FACTURE' },
          { numero: { startsWith: 'FAC' } },
        ],
        statut: { in: ['PAYEE', 'SOLDEE', 'ENCAISSE'] },
      },
    });

    return {
      totalDevis,
      validatedFactures,
      paidFactures,
      conversionToFacture:
        totalDevis > 0 ? (validatedFactures / totalDevis) * 100 : 0,
      conversionToPaid: totalDevis > 0 ? (paidFactures / totalDevis) * 100 : 0,
    };
  }

  async getStockByWarehouse(
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ): Promise<WarehouseStock[]> {
    const warehouses = await this.prisma.entrepot.findMany({
      where: centreId ? { centreId } : {},
      include: {
        produits: {
          select: {
            typeArticle: true,
            quantiteActuelle: true,
            prixAchatHT: true,
            prixVenteHT: true,
          },
        },
      },
    });

    return warehouses
      .map((w) => {
        const breakdownMap = new Map<
          string,
          { quantity: number; value: number }
        >();

        w.produits.forEach((p) => {
          const type = this.normalizeProductType(p.typeArticle || 'NON_DÉFINI');
          const existing = breakdownMap.get(type) || { quantity: 0, value: 0 };
          breakdownMap.set(type, {
            quantity: existing.quantity + (p.quantiteActuelle || 0),
            value:
              existing.value + (p.quantiteActuelle || 0) * (p.prixAchatHT || 0),
          });
        });

        const breakdown = Array.from(breakdownMap.entries()).map(
          ([type, data]) => ({
            type,
            quantity: data.quantity,
            value: data.value,
          }),
        );

        const totalQuantity = w.produits.reduce(
          (sum, p) => sum + (p.quantiteActuelle || 0),
          0,
        );
        const totalValue = w.produits.reduce(
          (sum, p) => sum + (p.quantiteActuelle || 0) * (p.prixAchatHT || 0),
          0,
        );

        return {
          warehouseName: w.nom,
          totalQuantity,
          totalValue,
          productCount: w.produits.length,
          breakdown,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);
  }

  async getTopClients(
    limit: number,
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ): Promise<TopClient[]> {
    const isValidDate = (d: string | undefined | null): boolean =>
      !!(d && d !== 'undefined' && d !== 'null' && d !== '');
    const start = isValidDate(startDate) ? new Date(startDate!) : new Date(0);
    const end = isValidDate(endDate)
      ? new Date(endDate!)
      : new Date(3000, 0, 1);

    const factures = await this.prisma.facture.findMany({
      where: {
        dateEmission: { gte: start, lte: end },
        centreId: centreId || undefined,
        statut: { notIn: ['ARCHIVE'] },
        type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR', 'DEVIS'] },
      },
      select: {
        clientId: true,
        totalTTC: true,
        client: {
          select: {
            nom: true,
            prenom: true,
            raisonSociale: true,
          },
        },
      },
    });

    const clientMap = new Map<
      string,
      { name: string; revenue: number; count: number }
    >();

    factures.forEach((f) => {
      const name =
        f.client.raisonSociale ||
        `${f.client.prenom || ''} ${f.client.nom || ''}`.trim();
      const existing = clientMap.get(f.clientId) || {
        name,
        revenue: 0,
        count: 0,
      };
      clientMap.set(f.clientId, {
        name: existing.name,
        revenue: existing.revenue + (f.totalTTC || 0),
        count: existing.count + 1,
      });
    });

    return Array.from(clientMap.entries())
      .map(([clientId, data]) => ({
        clientId,
        clientName: data.name,
        totalRevenue: data.revenue,
        invoiceCount: data.count,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  }

  async getPaymentMethods(
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ): Promise<PaymentMethodStat[]> {
    const isValidDate = (d: string | undefined | null): boolean =>
      !!(d && d !== 'undefined' && d !== 'null' && d !== '');
    const start = isValidDate(startDate) ? new Date(startDate!) : new Date(0);
    const end = isValidDate(endDate)
      ? new Date(endDate!)
      : new Date(3000, 0, 1);

    const payments = await this.prisma.paiement.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(centreId ? { facture: { centreId } } : {}),
      },
      select: {
        mode: true,
        montant: true,
      },
    });

    const methodMap = new Map<string, { count: number; total: number }>();

    payments.forEach((p) => {
      const method = p.mode || 'NON_SPÉCIFIÉ';
      const existing = methodMap.get(method) || { count: 0, total: 0 };
      methodMap.set(method, {
        count: existing.count + 1,
        total: existing.total + (p.montant || 0),
      });
    });

    return Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        count: data.count,
        totalAmount: data.total,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async getSummary(startDate?: string, endDate?: string, centreId?: string) {
    const isValidDate = (d: string | undefined | null): boolean =>
      !!(d && d !== 'undefined' && d !== 'null' && d !== '');
    const start = isValidDate(startDate) ? new Date(startDate!) : undefined;
    const end = isValidDate(endDate) ? new Date(endDate!) : undefined;

    // Get consolidated profit data to ensure consistency across dashboards
    const profitData = await this.getRealProfit(startDate, endDate, centreId);

    const [
      totalProducts,
      totalClients,
      activeWarehouses,
      fichesBreakdown,
      productsBreakdown,
    ] = await Promise.all([
      this.prisma.product.count({
        where: centreId
          ? {
              entrepot: { centreId },
            }
          : {},
      }),
      this.prisma.client.count({
        where: centreId ? { centreId } : {},
      }),
      this.prisma.entrepot.count({ where: centreId ? { centreId } : {} }),
      this.prisma.fiche.groupBy({
        by: ['type'],
        where: {
          client: centreId ? { centreId } : {},
        },
        _count: { _all: true },
      }),
      this.prisma.product.groupBy({
        by: ['typeArticle'],
        where: centreId
          ? {
              entrepot: { centreId },
            }
          : {},
        _count: { _all: true },
      }),
      this.prisma.client.groupBy({
        by: ['titre'],
        where: centreId ? { centreId } : {},
        _count: { _all: true },
      }),
    ]);

    const conversionMetrics = await this.getConversionRate(
      startDate,
      endDate,
      centreId,
    );

    const fichesStats = {
      total: 0,
      monture: 0,
      lentilles: 0,
      produit: 0,
    };

    fichesBreakdown.forEach((group) => {
      const count = group._count._all;
      fichesStats.total += count;
      const type = group.type.toLowerCase();
      if (type === 'monture') fichesStats.monture += count;
      else if (type === 'lentilles') fichesStats.lentilles += count;
      else if (type === 'produit') fichesStats.produit += count;
    });

    const productsStats: Record<string, number> = {};
    productsBreakdown.forEach((group: any) => {
      const rawType = group.typeArticle || 'NON_DÉFINI';
      const type = this.normalizeProductType(rawType);
      productsStats[type] =
        (productsStats[type] || 0) + (group._count?._all || 0);
    });

    return {
      totalProducts,
      totalClients,
      totalRevenue: profitData.revenue,
      totalRecettes: profitData.totalRecettes,
      // In Advanced Stats, "Total Dépenses" should represent all outgoing costs (COGS + OpEx)
      // to be consistent with the Net Profit calculation.
      totalExpenses: profitData.cogs + profitData.expenses,
      activeWarehouses,
      conversionRate: conversionMetrics.conversionToFacture,
      fichesStats,
      productsStats,
    };
  }

  private normalizeProductType(type: string): string {
    const t = type.toUpperCase().trim();
    if (t.includes('MONTURE_OPTIQUE') || t === 'MON' || t === 'MONTURE')
      return 'MON';
    if (t.includes('MONTURE_SOLAIRE') || t === 'SOL' || t === 'SOLAIRE')
      return 'SOL';
    if (t.includes('VERRE') || t === 'VERR') return 'VERR';
    if (t.includes('LENTILLE') || t === 'LEN') return 'LEN';
    if (t.includes('ACCESSOIRE') || t === 'ACC') return 'ACC';
    if (t === 'PRODUIT') return 'PRD';
    return t.substring(0, 4);
  }

  async getRealProfit(startDate?: string, endDate?: string, centreId?: string) {
    try {
      console.log("[StatsService] getRealProfit INPUTS:", { startDate, endDate, centreId });
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date(3000, 0, 1);
      const centreFilter = centreId ? { centreId } : {};

      // 1. Get de-duplicated sales data (including relations for COGS)
      const factures = await this.getFilteredSales(
        start,
        end,
        centreFilter,
        true,
      );

      // 2. Fetch expenses and payments in parallel
      const [expenseAgg, ffList, paymentsAgg, avoirAgg] = await Promise.all([
        this.prisma.depense.aggregate({
          _sum: { montant: true },
          where: {
            date: { gte: start, lte: end },
            factureFournisseurId: null,
            bonLivraisonId: null,
            statut: { notIn: ['REJETTE_ALIMENTATION', 'REJETEE'] },
            ...centreFilter,
          },
        }),
        this.prisma.factureFournisseur.findMany({
          where: {
            dateEmission: { gte: start, lte: end },
            type: { notIn: this.INVENTORY_PURCHASE_TYPES },
            ficheId: null,
            ...centreFilter,
          },
          select: {
            numeroFacture: true,
            montantHT: true,
            type: true,
            echeances: {
              where: {
                type: 'AVOIR',
                statut: { in: ['PAYEE', 'ENCAISSE'] }
              },
              select: { id: true }
            }
          }
        }),
        this.prisma.paiement.aggregate({
          _sum: { montant: true },
          where: {
            date: { gte: start, lte: end },
            ...(centreId ? { facture: { centreId } } : {}),
          },
        }),
        this.prisma.echeancePaiement.aggregate({
          _sum: { montant: true },
          where: {
            type: 'AVOIR',
            statut: { in: ['PAYEE', 'ENCAISSE'] },
            dateEncaissement: { gte: start, lte: end },
            factureFournisseurId: null,
            ...(centreId ? {
              OR: [
                { bonLivraison: { centreId } }
              ]
            } : {})
          }
        })
      ]);

      let totalRevenueTTC = 0;
      let totalCogs = 0;
      const cogsMap = new Map<string, number>();

      for (const f of factures) {
        const multiplier = f.type === 'AVOIR' ? -1 : 1;

        // Revenue
        totalRevenueTTC += multiplier * (f.totalTTC || 0);

        // COGS
        // a. Montures & Others: via mouvements réels
        if (f.mouvementsStock?.length) {
          f.mouvementsStock.forEach((m: any) => {
            const cost = multiplier * (m.prixAchatUnitaire || 0);
            totalCogs += cost;
            const cat = this.normalizeProductType(
              m.produit?.typeArticle || m.typeArticle || 'MON',
            );
            cogsMap.set(cat, (cogsMap.get(cat) || 0) + cost);
          });
        }
        // b. Verres : via BL rapports
        if (f.fiche?.bonsLivraison?.length) {
          f.fiche.bonsLivraison.forEach((bl: any) => {
            const cost = multiplier * (bl.montantHT || 0);
            totalCogs += cost;
            const cat = 'VERR';
            cogsMap.set(cat, (cogsMap.get(cat) || 0) + cost);
          });
        }
      }

      let ffExpenses = 0;
      ffList.forEach((f: any) => {
        const isAvoir = f.numeroFacture.startsWith('AV') || f.numeroFacture.startsWith('av') || f.numeroFacture.startsWith('CN') || f.numeroFacture.startsWith('cn') || f.type?.toUpperCase() === 'AVOIR';
        const amount = Math.abs(f.montantHT || 0);
        if (isAvoir) {
          ffExpenses -= amount;
        } else {
          ffExpenses += amount;
        }
      });

      const revenueHT = totalRevenueTTC / 1.2;
      const expenses =
        (expenseAgg._sum?.montant || 0) + ffExpenses - (avoirAgg._sum?.montant || 0);
      const netProfit = revenueHT - totalCogs - expenses;

      // Expense Breakdown logic
      const expensesBreakdownMap = new Map<string, number>();

      // Let's fetch them to be perfect
      const [depensesList, ffListForBreakdown, avoirList] = await Promise.all([
        this.prisma.depense.findMany({
          where: {
            date: { gte: start, lte: end },
            factureFournisseurId: null,
            bonLivraisonId: null,
            statut: { notIn: ['REJETTE_ALIMENTATION', 'REJETEE'] },
            ...centreFilter,
          },
          select: { montant: true, categorie: true },
        }),
        this.prisma.factureFournisseur.findMany({
          where: {
            dateEmission: { gte: start, lte: end },
            type: { notIn: this.INVENTORY_PURCHASE_TYPES },
            ficheId: null,
            ...centreFilter,
          },
          select: {
            numeroFacture: true,
            montantHT: true,
            type: true,
            echeances: {
              where: {
                type: 'AVOIR',
                statut: { in: ['PAYEE', 'ENCAISSE'] }
              },
              select: { id: true }
            }
          },
        }),
        this.prisma.echeancePaiement.findMany({
          where: {
            type: 'AVOIR',
            statut: { in: ['PAYEE', 'ENCAISSE'] },
            dateEncaissement: { gte: start, lte: end },
            factureFournisseurId: null,
            ...(centreId ? {
              OR: [
                { bonLivraison: { centreId } }
              ]
            } : {})
          },
          select: { montant: true }
        })
      ]);

      depensesList.forEach((d) => {
        const cat = d.categorie || 'DIVERS';
        expensesBreakdownMap.set(
          cat,
          (expensesBreakdownMap.get(cat) || 0) + (d.montant || 0),
        );
      });
      ffListForBreakdown.forEach((f: any) => {
        const isAvoir = f.numeroFacture.startsWith('AV') || f.numeroFacture.startsWith('av') || f.numeroFacture.startsWith('CN') || f.numeroFacture.startsWith('cn') || f.type?.toUpperCase() === 'AVOIR';
        const amount = Math.abs(f.montantHT || 0);
        const cat = isAvoir ? 'AVOIR_FOURNISSEUR' : (f.type || 'FACTURE');
        if (isAvoir) {
          expensesBreakdownMap.set(
            cat,
            (expensesBreakdownMap.get(cat) || 0) - amount,
          );
        } else {
          expensesBreakdownMap.set(
            cat,
            (expensesBreakdownMap.get(cat) || 0) + amount,
          );
        }
      });
      avoirList.forEach((e) => {
        const cat = 'AVOIR_FOURNISSEUR';
        expensesBreakdownMap.set(
          cat,
          (expensesBreakdownMap.get(cat) || 0) - (e.montant || 0),
        );
      });

      return {
        revenue: revenueHT,
        caTTC: totalRevenueTTC,
        cogs: totalCogs,
        expenses: expenses,
        netProfit: netProfit,
        totalRecettes: paymentsAgg._sum?.montant || 0,
        analysis: {
          marginRate: revenueHT > 0 ? (netProfit / revenueHT) * 100 : 0,
          cogsRate: revenueHT > 0 ? (totalCogs / revenueHT) * 100 : 0,
          expenseRate: revenueHT > 0 ? (expenses / revenueHT) * 100 : 0,
        },
        cogsBreakdown: Array.from(cogsMap.entries()).map(
          ([category, amount]) => ({
            category,
            amount,
            percentage: totalCogs > 0 ? (amount / totalCogs) * 100 : 0,
          }),
        ),
        expensesBreakdown: Array.from(expensesBreakdownMap.entries()).map(
          ([category, amount]) => ({
            category,
            amount,
            percentage: expenses > 0 ? (amount / expenses) * 100 : 0,
          }),
        ),
      };
    } catch (e) {
      console.error('[Stats] getRealProfit Error:', e);
      return {
        revenue: 0,
        cogs: 0,
        expenses: 0,
        netProfit: 0,
        totalRecettes: 0,
        analysis: { marginRate: 0 },
        cogsBreakdown: [],
        expensesBreakdown: [],
      };
    }
  }

  async getProfitEvolution(
    period: 'daily' | 'monthly' = 'monthly',
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ) {
    try {
      const start = startDate
        ? new Date(startDate)
        : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate) : new Date();
      const centreFilter = centreId ? { centreId } : {};

      const factures = await this.getFilteredSales(
        start,
        end,
        centreFilter,
        true,
      );

      const depenses = await this.prisma.depense.findMany({
        where: {
          date: { gte: start, lte: end },
          statut: { notIn: ['REJETTE_ALIMENTATION', 'REJETEE'] },
          ...centreFilter,
        },
      });

      const dataMap = new Map<
        string,
        { revenue: number; cogs: number; expenses: number }
      >();

      factures.forEach((f) => {
        const label =
          period === 'daily'
            ? f.dateEmission.toISOString().split('T')[0]
            : f.dateEmission.toISOString().substring(0, 7);

        const vals = dataMap.get(label) || { revenue: 0, cogs: 0, expenses: 0 };

        const multiplier = f.type === 'AVOIR' ? -1 : 1;
        vals.revenue += (multiplier * (f.totalTTC || 0)) / 1.2;

        // COGS
        if (f.mouvementsStock?.length) {
          vals.cogs +=
            multiplier *
            f.mouvementsStock.reduce(
              (s, m) => s + (m.prixAchatUnitaire || 0),
              0,
            );
        }
        if (f.fiche?.bonsLivraison?.length) {
          vals.cogs +=
            multiplier *
            f.fiche.bonsLivraison.reduce((s, bl) => s + (bl.montantHT || 0), 0);
        }

        dataMap.set(label, vals);
      });

      depenses.forEach((d) => {
        const label =
          period === 'daily'
            ? d.date.toISOString().split('T')[0]
            : d.date.toISOString().substring(0, 7);

        const vals = dataMap.get(label) || { revenue: 0, cogs: 0, expenses: 0 };
        vals.expenses += d.montant || 0;
        dataMap.set(label, vals);
      });

      const ff = await this.prisma.factureFournisseur.findMany({
        where: {
          dateEmission: { gte: start, lte: end },
          ...centreFilter,
        },
        include: {
          echeances: {
            where: {
              type: 'AVOIR',
              statut: { in: ['PAYEE', 'ENCAISSE'] }
            },
            select: { id: true }
          }
        }
      });

      ff.forEach((f) => {
        const label =
          period === 'daily'
            ? f.dateEmission.toISOString().split('T')[0]
            : f.dateEmission.toISOString().substring(0, 7);

        const vals = dataMap.get(label) || { revenue: 0, cogs: 0, expenses: 0 };

        const isAvoir = f.numeroFacture.startsWith('AV') || f.numeroFacture.startsWith('av') || f.numeroFacture.startsWith('CN') || f.numeroFacture.startsWith('cn') || f.type?.toUpperCase() === 'AVOIR';
        const isInventory = this.INVENTORY_PURCHASE_TYPES.includes(f.type || '');
        const amount = Math.abs(f.montantTTC || f.montantHT || 0);

        if (isInventory) {
          if (isAvoir) {
            vals.cogs -= amount;
          } else {
            vals.cogs += amount;
          }
        } else {
          if (isAvoir) {
            vals.expenses -= amount;
          } else {
            vals.expenses += amount;
          }
        }
        dataMap.set(label, vals);
      });
      
      const avoirEcheances = await this.prisma.echeancePaiement.findMany({
        where: {
          type: 'AVOIR',
          statut: { in: ['PAYEE', 'ENCAISSE'] },
          dateEncaissement: { gte: start, lte: end },
          factureFournisseurId: null,
          ...(centreId ? {
            OR: [
              { bonLivraison: { centreId } }
            ]
          } : {})
        }
      });
      
      avoirEcheances.forEach((e) => {
        const date = e.dateEncaissement || e.dateEcheance;
        const label =
          period === 'daily'
            ? date.toISOString().split('T')[0]
            : date.toISOString().substring(0, 7);

        const vals = dataMap.get(label) || { revenue: 0, cogs: 0, expenses: 0 };
        vals.expenses -= e.montant || 0;
        dataMap.set(label, vals);
      });

      const sortedResult = Array.from(dataMap.entries())
        .map(([label, vals]) => ({
          month: label,
          revenue: vals.revenue,
          expenses: vals.cogs + vals.expenses,
          cogs: vals.cogs,
          netProfit: vals.revenue - (vals.cogs + vals.expenses),
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return sortedResult;
    } catch (error) {
      console.error('[Stats] getProfitEvolution Error:', error);
      return [];
    }
  }

  async getRevenueDetails(
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date(3000, 0, 1);
    const centreFilter = centreId ? { centreId } : {};

    const filtered = await this.getFilteredSales(start, end, centreFilter, {
      client: { select: { nom: true, prenom: true, raisonSociale: true } },
    });

    return filtered
      .sort((a, b) => b.dateEmission.getTime() - a.dateEmission.getTime())
      .map((f: any) => ({
        id: f.id,
        date: f.dateEmission,
        numero: f.numero,
        client:
          f.client.raisonSociale ||
          `${f.client.prenom || ''} ${f.client.nom || ''}`.trim(),
        type: f.type,
        totalTTC: f.totalTTC,
        totalHT: (f.totalTTC || 0) / 1.2,
        statut: f.statut,
      }));
  }

  async getExpenseDetails(
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date(3000, 0, 1);
    const centreFilter = centreId ? { centreId } : {};

    // 1. Get the EXACT same list of sales as getRealProfit
    const factures = await this.getFilteredSales(
      start,
      end,
      centreFilter,
      true,
    );
    const results: any[] = [];

    for (const f of factures) {
      const multiplier = f.type === 'AVOIR' ? -1 : 1;

      // a. COGS from movements (Montures, Lentilles, Accessories, etc.)
      if (f.mouvementsStock?.length) {
        f.mouvementsStock.forEach((m: any) => {
          const cost = multiplier * (m.prixAchatUnitaire || 0);
          if (cost === 0 && multiplier === 1) return; // Skip zero-cost items unless it's an Avoir

          const type = this.normalizeProductType(
            m.produit?.typeArticle || m.typeArticle || 'MON',
          );
          let libellePrefix = 'COGS';
          if (type === 'MON') libellePrefix = 'COGS (Monture)';
          else if (type === 'LEN') libellePrefix = 'COGS (Lentille)';
          else if (type === 'ACC') libellePrefix = 'COGS (Accessoire)';
          else if (type === 'PRD') libellePrefix = 'COGS (Produit)';

          results.push({
            id: `move-${m.id}`,
            date: f.dateEmission,
            libelle: `${libellePrefix}: ${m.produit?.designation || 'Article'} [Vente ${f.numero}]`,
            fournisseur: m.produit?.marque || 'STOCK',
            type: 'COGS',
            montant: cost,
            statut: f.type === 'AVOIR' ? 'AVOIR' : 'VALIDE',
            source: m.motif === 'RETOUR' ? 'COGS_RETOUR' : 'COGS_REEL_STOCK',
          });
        });
      }

      // b. COGS from BLs (Verres)
      if (f.fiche?.bonsLivraison?.length) {
        f.fiche.bonsLivraison.forEach((bl: any) => {
          const cost = multiplier * (bl.montantHT || 0);
          results.push({
            id: `bl-${bl.id}`,
            date: bl.dateEmission,
            libelle: `COGS (Verres): ${bl.numeroBL} [Vente ${f.numero}]`,
            fournisseur: bl.fournisseur?.nom || 'FOURNISSEUR',
            type: 'COGS',
            montant: cost,
            statut: f.type === 'AVOIR' ? 'AVOIR' : 'VALIDE',
            source: 'COGS_ACHAT_BL',
          });
        });
      }
    }

    // 2. OpEx (Depenses & Factures Fournisseurs)
    const [depenses, opexFf] = await Promise.all([
      this.prisma.depense.findMany({
        where: {
          date: { gte: start, lte: end },
          factureFournisseurId: null,
          bonLivraisonId: null,
          statut: { notIn: ['REJETTE_ALIMENTATION', 'REJETEE'] },
          ...centreFilter,
        },
        include: { fournisseur: { select: { nom: true } } },
      }),
      this.prisma.factureFournisseur.findMany({
        where: {
          dateEmission: { gte: start, lte: end },
          type: { notIn: this.INVENTORY_PURCHASE_TYPES },
          ficheId: null,
          ...centreFilter,
        },
        include: { fournisseur: { select: { nom: true } } },
      }),
    ]);

    results.push(
      ...depenses.map((d: any) => ({
        id: d.id,
        date: d.date,
        libelle: `Charge Courante: ${d.description || d.reference || 'Dépense'}`,
        fournisseur: d.fournisseur?.nom || 'DIVERS',
        type: d.categorie || 'CHARGE',
        montant: d.montant,
        statut: d.statut,
        source: 'CHARGE_COURANTE',
      })),
    );

    results.push(
      ...opexFf.map((f: any) => ({
        id: f.id,
        date: f.dateEmission,
        libelle: `Facture Charge: ${f.numeroFacture || f.referenceInterne || 'FF'}`,
        fournisseur: f.fournisseur?.nom || 'FOURNISSEUR',
        type: f.type || 'CHARGE_EXT',
        montant: f.montantHT,
        statut: 'VALIDE',
        source: 'FACTURE_CHARGE',
      })),
    );

    return results.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }
  async getProductSalesDetailsV2(
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date(3000, 0, 1);
    const centreFilter = centreId ? { centreId } : {};

    const factures = await this.getFilteredSales(
      start,
      end,
      centreFilter,
      true,
    );

    const productMap = new Map<
      string,
      {
        type: string;
        brand: string;
        operation: string;
        quantity: number;
        purchaseTotal: number;
        saleTotal: number;
      }
    >();

    // --- BATCH CATALOG PRICE LOOKUP ---
    // Collect all unique produitIds from all invoice lines in one pass
    const allProduitIds = new Set<string>();
    for (const f of factures) {
      for (const line of (f.lignes as any[]) || []) {
        if (line.produitId) allProduitIds.add(line.produitId);
      }
    }
    // Single DB query for all product catalog prices - avoids N+1
    const catalogProducts = await this.prisma.product.findMany({
      where: { id: { in: Array.from(allProduitIds) } },
      select: { id: true, prixAchatHT: true, marque: true, typeArticle: true },
    });
    const catalogMap = new Map<
      string,
      {
        prixAchatHT: number;
        marque?: string | null;
        typeArticle?: string | null;
      }
    >(catalogProducts.map((p: any) => [p.id, p]));
    // --- END BATCH LOOKUP ---

    for (const f of factures) {
      const invoiceHT = (f.totalTTC || 0) / 1.2;
      const lines = (f.lignes as any[]) || [];
      const sumLinesValue = lines.reduce((acc, l) => {
        const qty = l.qte ?? l.quantite ?? 0;
        const price = l.prixUnitaireHT ?? l.prixUnitaireTTC ?? 0;
        const lineTotal = l.totalHT ?? l.totalTTC ?? qty * price;
        return acc + lineTotal;
      }, 0);

      if (sumLinesValue === 0 && invoiceHT === 0) continue;

      const operation = f.type === 'AVOIR' ? 'AVOIR' : 'VENTE';

      // Build cost-per-type from mouvementsStock (produitId is NOT in lignes JSON,
      // so we group by typeArticle to match movement costs to invoice lines)
      const costByType = new Map<
        string,
        { totalCost: number; totalQty: number }
      >();
      for (const mv of f.mouvementsStock || []) {
        const rawType = mv.produit?.typeArticle || mv.typeArticle || '';
        const normType = this.normalizeProductType(rawType);
        if (!normType) continue;
        const qty = Math.abs(mv.quantite || 1);
        const unitCost = mv.prixAchatUnitaire || mv.produit?.prixAchatHT || 0;
        const existing = costByType.get(normType) || {
          totalCost: 0,
          totalQty: 0,
        };
        existing.totalCost += qty * unitCost;
        existing.totalQty += qty;
        costByType.set(normType, existing);
      }
      // Also keep a produitId Map for future cases where lignes might include produitId
      const stockByProduitId = new Map<string, any>();
      for (const mv of f.mouvementsStock || []) {
        if (mv.produitId) stockByProduitId.set(mv.produitId, mv);
      }

      for (const line of lines) {
        let type = this.normalizeProductType(line.typeArticle || '');
        let brand = 'SANS MARQUE';

        const qty = line.qte ?? line.quantite ?? 1;
        const price = line.prixUnitaireHT ?? line.prixUnitaireTTC ?? 0;
        const lineVal = line.totalHT ?? line.totalTTC ?? qty * price;

        // Apply proportional share of the invoice's Net HT (handles discounts correctly)
        const proportionalHT =
          sumLinesValue !== 0 ? (lineVal / sumLinesValue) * invoiceHT : 0;

        // Try to identify Brand and refined Type
        if (line.produitId) {
          const product = f.mouvementsStock?.find(
            (m) => m.produitId === line.produitId,
          )?.produit;
          if (product) {
            brand = product.marque || product.collection || 'SANS MARQUE';
            if (!type || type === 'PRD' || type === 'NON_')
              type = this.normalizeProductType(product.typeArticle || 'MON');
          }
        }

        if (!type || type === 'PRD' || type === 'NON_') {
          const desc = String(line.description || '').toLowerCase();
          if (desc.includes('verre')) type = 'VERR';
          else if (desc.includes('monture')) type = 'MON';
          else if (desc.includes('lentille')) type = 'LEN';
          else if (desc.includes('solaire')) type = 'SOL';
          else if (f.fiche?.type)
            type = this.normalizeProductType(f.fiche.type);
          else type = 'ACC';
        }

        if (type === 'VERR' && brand === 'SANS MARQUE') {
          brand = f.fiche?.bonsLivraison?.[0]?.fournisseur?.nom || 'VERRIER';
        }

        const key = `${type}-${brand}-${operation}`;
        const existing = productMap.get(key) || {
          type,
          brand,
          operation,
          quantity: 0,
          purchaseTotal: 0,
          saleTotal: 0,
        };

        existing.quantity += Math.abs(qty);
        existing.saleTotal += Math.abs(proportionalHT);

        // COGS Estimation — primary: type-based average from mouvementsStock
        // (produitId is never stored in lignes JSON, so we group by typeArticle)
        const typeData = costByType.get(type);
        if (typeData && typeData.totalQty > 0) {
          // Use average unit cost for this type from the facture's movements
          const avgUnitCost = typeData.totalCost / typeData.totalQty;
          existing.purchaseTotal += Math.abs(qty) * avgUnitCost;
        } else if (line.produitId) {
          // Fallback: if the line has a produitId, use stockByProduitId or catalogMap
          const m = stockByProduitId.get(line.produitId);
          const catalogPrice = catalogMap.get(line.produitId)?.prixAchatHT || 0;
          const unitCost =
            m?.prixAchatUnitaire || m?.produit?.prixAchatHT || catalogPrice;
          existing.purchaseTotal += Math.abs(qty) * unitCost;
        } else if (type === 'VERR') {
          // Last resort for VERR: proportional share of linked BL cost
          const glassLinesTotal =
            lines
              .filter(
                (l: any) =>
                  l.typeArticle === 'VERRE' ||
                  String(l.description || '')
                    .toLowerCase()
                    .includes('verre'),
              )
              .reduce(
                (s: number, l: any) => s + (l.totalHT ?? l.totalTTC ?? 0),
                0,
              ) || 1;
          const blTotalCost =
            f.fiche?.bonsLivraison?.reduce(
              (acc: number, bl: any) => acc + (bl.montantHT || 0),
              0,
            ) || 0;
          existing.purchaseTotal += (lineVal / glassLinesTotal) * blTotalCost;
        }

        productMap.set(key, existing);
      }
    }

    return Array.from(productMap.values())
      .map((p) => ({
        ...p,
        avgPurchasePrice: p.quantity !== 0 ? p.purchaseTotal / p.quantity : 0,
        avgSalePrice: p.quantity !== 0 ? p.saleTotal / p.quantity : 0,
      }))
      .sort((a, b) => a.type.localeCompare(b.type) || b.quantity - a.quantity);
  }
}
