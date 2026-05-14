import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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

  private async getFilteredSales(start: Date, end: Date, centreFilter: any, includeRelations: any = false) {
    const facturesRaw = await this.prisma.facture.findMany({
      where: {
        dateEmission: { gte: start, lte: end },
        statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
        type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR'] },
        ...centreFilter,
      },
      include: includeRelations === true ? {
        fiche: { include: { bonsLivraison: true } },
        mouvementsStock: true,
      } : (includeRelations || undefined),
    }) as any[];

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
          type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR', 'DEVIS'] },
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
    if (t.includes('MONTURE_OPTIQUE') || t === 'MON' || t === 'MONTURE') return 'MON';
    if (t.includes('MONTURE_SOLAIRE') || t === 'SOL' || t === 'SOLAIRE') return 'SOL';
    if (t.includes('VERRE') || t === 'VERR') return 'VERR';
    if (t.includes('LENTILLE') || t === 'LEN') return 'LEN';
    if (t.includes('ACCESSOIRE') || t === 'ACC') return 'ACC';
    if (t === 'PRODUIT') return 'PRD';
    return t.substring(0, 4);
  }

  async getRealProfit(
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date(3000, 0, 1);
      const centreFilter = centreId ? { centreId } : {};

      // 1. Get de-duplicated sales data (including relations for COGS)
      const factures = await this.getFilteredSales(start, end, centreFilter, true);

      // 2. Fetch expenses and payments in parallel
      const [expenseAgg, ffAgg, paymentsAgg] = await Promise.all([
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
        this.prisma.factureFournisseur.aggregate({
          _sum: { montantHT: true },
          where: {
            dateEmission: { gte: start, lte: end },
            type: { notIn: this.INVENTORY_PURCHASE_TYPES },
            ficheId: null,
            ...centreFilter,
          },
        }),
        this.prisma.paiement.aggregate({
          _sum: { montant: true },
          where: {
            date: { gte: start, lte: end },
            ...(centreId ? { facture: { centreId } } : {}),
          },
        }),
      ]);

      let totalRevenueTTC = 0;
      let totalCogs = 0;
      const cogsMap = new Map<string, number>();

      for (const f of factures) {
        const multiplier = f.type === 'AVOIR' ? -1 : 1;

        // Revenue
        totalRevenueTTC += multiplier * (f.totalTTC || 0);

        // COGS
        // a. Montures : via mouvements réels
        if (f.mouvementsStock?.length) {
          f.mouvementsStock.forEach((m: any) => {
            const cost = multiplier * (m.prixAchatUnitaire || 0);
            totalCogs += cost;
            const cat = this.normalizeProductType(m.typeArticle || 'MON');
            cogsMap.set(cat, (cogsMap.get(cat) || 0) + cost);
          });
        }
        // b. Verres : via BL rattachés
        if (f.fiche?.bonsLivraison?.length) {
          f.fiche.bonsLivraison.forEach((bl: any) => {
            const cost = multiplier * (bl.montantHT || 0);
            totalCogs += cost;
            const cat = 'VERR';
            cogsMap.set(cat, (cogsMap.get(cat) || 0) + cost);
          });
        }
      }

      const revenueHT = totalRevenueTTC / 1.2;
      const expenses = (expenseAgg._sum?.montant || 0) + (ffAgg._sum?.montantHT || 0);
      const netProfit = revenueHT - totalCogs - expenses;

      // Expense Breakdown logic
      const expensesBreakdownMap = new Map<string, number>();
      // We can't easily get the breakdown from aggregate, but for now let's just return a generic breakdown or fetch it
      // For simplicity and speed, let's just return the main values first. 
      // If the user really needs the breakdown table to be populated, I should fetch the lists.
      
      // Let's fetch them to be perfect
      const [depensesList, ffList] = await Promise.all([
        this.prisma.depense.findMany({
          where: { date: { gte: start, lte: end }, factureFournisseurId: null, bonLivraisonId: null, statut: { notIn: ['REJETTE_ALIMENTATION', 'REJETEE'] }, ...centreFilter },
          select: { montant: true, categorie: true }
        }),
        this.prisma.factureFournisseur.findMany({
          where: { dateEmission: { gte: start, lte: end }, type: { notIn: this.INVENTORY_PURCHASE_TYPES }, ficheId: null, ...centreFilter },
          select: { montantHT: true, type: true }
        })
      ]);

      depensesList.forEach(d => {
        const cat = d.categorie || 'DIVERS';
        expensesBreakdownMap.set(cat, (expensesBreakdownMap.get(cat) || 0) + (d.montant || 0));
      });
      ffList.forEach(f => {
        const cat = f.type || 'FACTURE';
        expensesBreakdownMap.set(cat, (expensesBreakdownMap.get(cat) || 0) + (f.montantHT || 0));
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
        cogsBreakdown: Array.from(cogsMap.entries()).map(([category, amount]) => ({
          category,
          amount,
          percentage: totalCogs > 0 ? (amount / totalCogs) * 100 : 0,
        })),
        expensesBreakdown: Array.from(expensesBreakdownMap.entries()).map(([category, amount]) => ({
          category,
          amount,
          percentage: expenses > 0 ? (amount / expenses) * 100 : 0,
        })),
      };
    } catch (e) {
      console.error('[Stats] getRealProfit Error:', e);
      return { revenue: 0, cogs: 0, expenses: 0, netProfit: 0, totalRecettes: 0, analysis: { marginRate: 0 }, cogsBreakdown: [], expensesBreakdown: [] };
    }
  }

  async getProfitEvolution(
    period: 'daily' | 'monthly' = 'monthly',
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate) : new Date();
      const centreFilter = centreId ? { centreId } : {};

      const factures = await this.getFilteredSales(start, end, centreFilter, true);

      const depenses = await this.prisma.depense.findMany({
        where: {
          date: { gte: start, lte: end },
          statut: { notIn: ['REJETTE_ALIMENTATION', 'REJETEE'] },
          ...centreFilter,
        },
      });

      const dataMap = new Map<string, { revenue: number; cogs: number; expenses: number }>();

      factures.forEach((f) => {
        const label = period === 'daily' 
          ? f.dateEmission.toISOString().split('T')[0]
          : f.dateEmission.toISOString().substring(0, 7);
        
        const vals = dataMap.get(label) || { revenue: 0, cogs: 0, expenses: 0 };
        
        const multiplier = f.type === 'AVOIR' ? -1 : 1;
        vals.revenue += multiplier * (f.totalTTC || 0) / 1.2;

        // COGS
        if (f.mouvementsStock?.length) {
          vals.cogs += multiplier * f.mouvementsStock.reduce((s, m) => s + (m.prixAchatUnitaire || 0), 0);
        }
        if (f.fiche?.bonsLivraison?.length) {
          vals.cogs += multiplier * f.fiche.bonsLivraison.reduce((s, bl) => s + (bl.montantHT || 0), 0);
        }

        dataMap.set(label, vals);
      });

      depenses.forEach((d) => {
        const label = period === 'daily'
          ? d.date.toISOString().split('T')[0]
          : d.date.toISOString().substring(0, 7);
        
        const vals = dataMap.get(label) || { revenue: 0, cogs: 0, expenses: 0 };
        vals.expenses += d.montant || 0;
        dataMap.set(label, vals);
      });

      const sortedResult = Array.from(dataMap.entries())
        .map(([label, vals]) => ({
          month: label, // We keep 'month' key for frontend compatibility even if daily
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

    const factures = await this.prisma.facture.findMany({
      where: {
        dateEmission: { gte: start, lte: end },
        type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM'] },
        statut: { not: 'ARCHIVE' },
        ...centreFilter,
      },
      include: {
        fiche: {
          include: {
            bonsLivraison: {
              include: { fournisseur: true }
            }
          }
        },
        mouvementsStock: {
          include: { produit: true }
        }
      },
    });

    const results: any[] = [];

    for (const f of factures) {
      if (!f.fiche) continue;

      const lines = (typeof f.lignes === 'string' ? JSON.parse(f.lignes as string) : f.lignes) as any[];
      if (!Array.isArray(lines)) continue;

      const montures = lines.filter(l => 
        l.typeArticle === 'MONTURE' || l.typeArticle === 'SOLAIRE' || l.description?.toLowerCase().includes('monture')
      );
      
      for (const m of montures) {
        const move = (f.mouvementsStock || []).find(ms => ms.produitId === m.productId || ms.produit?.codeInterne === m.codeInterne);
        const cost = move?.prixAchatUnitaire || 0;

        results.push({
          id: `m-${m.id || Math.random()}`,
          date: f.dateEmission,
          libelle: `COGS (Monture): ${m.designation || 'Monture'} [Vente ${f.numero}]`,
          fournisseur: m.marque || 'STOCK',
          type: 'COGS',
          montant: cost,
          statut: 'VALIDE',
          source: move ? 'COGS_REEL_STOCK' : 'COGS_ESTIMATION',
        });
      }

      for (const bl of f.fiche.bonsLivraison) {
        results.push({
          id: `bl-${bl.id}`,
          date: bl.dateEmission,
          libelle: `COGS (Verres): ${bl.numeroBL} [Vente ${f.numero}]`,
          fournisseur: bl.fournisseur?.nom || 'FOURNISSEUR',
          type: 'COGS',
          montant: bl.montantHT, 
          statut: 'VALIDE',
          source: 'COGS_ACHAT_BL',
        });
      }
    }

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

    results.push(...depenses.map((d: any) => ({
      id: d.id,
      date: d.date,
      libelle: `OPEX: ${d.description || d.reference || 'DEP'}`,
      fournisseur: d.fournisseur?.nom || 'DIVERS',
      type: d.categorie || 'CHARGE',
      montant: d.montant,
      statut: d.statut,
      source: 'DEPENSE_OPE',
    })));

    results.push(...opexFf.map((f: any) => ({
      id: f.id,
      date: f.dateEmission,
      libelle: `OPEX (Facture): ${f.numeroFacture || f.referenceInterne || 'FF'}`,
      fournisseur: f.fournisseur?.nom || 'FOURNISSEUR',
      type: f.type || 'CHARGE_EXT',
      montant: f.montantHT,
      statut: 'VALIDE',
      source: 'FACTURE_OPEX',
    })));

    return results.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }
}
