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
    'ACHAT MONTURES OPTIQUES',
    'ACHAT LENTILLES DE CONTACT',
    'ACHAT ACCESSOIRES OPTIQUES',
    'ACHAT_STOCK',
  ];

  private readonly OPERATIONAL_PURCHASE_TYPES = [
    'ELECTRICITE',
    'INTERNET',
    'ASSURANCE',
    'FRAIS BANCAIRES',
    'AUTRES CHARGES',
    'REGLEMENT CONSOMMATION EAU',
    'REGLEMENT SALAIRS OPTIQUES',
    'LOYER',
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

  async getRevenueEvolution(
    period: 'daily' | 'monthly' | 'yearly',
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ): Promise<RevenueDataPoint[]> {
    const isValidDate = (d: string | undefined | null): boolean =>
      !!(d && d !== 'undefined' && d !== 'null' && d !== '');

    // For All Period (start/end undefined), we want to see everything
    // But we MUST have a start date to fill gaps correctly if we want a range.
    // We'll use the earliest and latest emission dates from the DB if not provided.

    let start = isValidDate(startDate) ? new Date(startDate!) : undefined;
    let end = isValidDate(endDate) ? new Date(endDate!) : undefined;

    // To properly aggregate and fill gaps, we need a concrete range
    if (!start || !end) {
      const range = await this.prisma.facture.aggregate({
        where: {
          centreId: centreId || undefined,
          statut: { notIn: ['ARCHIVE'] },
          type: { in: ['FACTURE', 'BON_COMMANDE', 'AVOIR', 'DEVIS'] },
        },
        _min: { dateEmission: true },
        _max: { dateEmission: true },
      });
      if (!start) start = range._min.dateEmission || new Date(2024, 0, 1);
      if (!end) end = range._max.dateEmission || new Date();
    }

    const factures = await this.prisma.facture.findMany({
      where: {
        dateEmission: { gte: start, lte: end },
        centreId: centreId || undefined,
        statut: { notIn: ['ARCHIVE'] },
        type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR', 'DEVIS'] },
      },
      select: {
        dateEmission: true,
        totalTTC: true,
        type: true,
      },
    });

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
        type: { in: ['FACTURE', 'BON_COMMANDE', 'DEVIS'] }, // Exclude Avoirs from distribution counts
      },
      select: {
        lignes: true,
        fiche: { select: { type: true } }
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
          const lineTotal = l.totalHT ?? l.totalTTC ?? (qty * price);

          // Use typeArticle if set, otherwise infer from fiche type or description
          let type = l.typeArticle;
          if (!type && l.description) {
            const desc = String(l.description).toLowerCase();
            if (desc.includes('verre') || desc.includes('verres')) type = 'VERRE';
            else if (desc.includes('monture')) type = 'MONTURE';
            else if (desc.includes('lentille')) type = 'LENTILLES';
            else if (desc.includes('produit') || desc.includes('accessoire')) type = 'ACCESSOIRE';
          }
          if (!type && f.fiche?.type) {
            // Map fiche type to article category
            const ficheType = f.fiche.type.toLowerCase();
            if (ficheType === 'monture') type = 'MONTURE';
            else if (ficheType === 'lentilles') type = 'LENTILLES';
          }
          if (!type) type = 'NON_DÉFINI';

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
        type: { in: ['FACTURE', 'BON_COMMANDE', 'DEVIS'] },
      },
    });

    // Ventes avec au moins un paiement = "converties"
    const validatedFactures = await this.prisma.facture.count({
      where: {
        ...whereClause,
        type: { in: ['FACTURE', 'BON_COMMANDE', 'DEVIS'] },
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
          const type = p.typeArticle || 'NON_DÉFINI';
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

    const productsStats: any = {};
    productsBreakdown.forEach((group: any) => {
      const type = group.typeArticle || 'NON_DÉFINI';
      productsStats[type] = group._count?._all || 0;
    });

    return {
      totalProducts,
      totalClients,
      totalRevenue: profitData.revenue,
      // In Advanced Stats, "Total Dépenses" should represent all outgoing costs (COGS + OpEx)
      // to be consistent with the Net Profit calculation.
      totalExpenses: profitData.cogs + profitData.expenses,
      activeWarehouses,
      conversionRate: conversionMetrics.conversionToFacture,
      fichesStats,
      productsStats,
    };
  }

  async getRealProfit(startDate?: string, endDate?: string, centreId?: string) {
    try {
      const tenantId =
        centreId && centreId.trim() && centreId !== 'undefined' && centreId !== 'null' && centreId !== ''
          ? centreId
          : undefined;
      const start =
        startDate && startDate !== 'undefined' && startDate !== 'null' && startDate !== ''
          ? new Date(startDate)
          : new Date(1970, 0, 1);
      const end =
        endDate && endDate !== 'undefined' && endDate !== 'null' && endDate !== ''
          ? new Date(endDate)
          : new Date(3000, 0, 1);

      const centreFilter = tenantId ? { centreId: tenantId } : {};
      const activeStatus = { statut: { notIn: ['ARCHIVE', 'ANNULEE'] as any[] } };
      const dateFilter = { dateEmission: { gte: start, lte: end } };

      console.log(`[STATS-PROFIT] Start: ${start.toISOString()}, End: ${end.toISOString()}, Tenant: ${tenantId}`);

      // ─────────────────────────────────────────────────────────────────────
      // ÉTAPE 1 ► Source de vérité unique : même logique que SalesControlService
      //
      // On utilise 3 agrégations DB distinctes (FACTURE / BC / AVOIR) avec la
      // même déduplication que getDashboardData() → garantit que :
      //    revenue (HT) × 1.2  ≡  CA Global TTC (Contrôle des Ventes)
      // ─────────────────────────────────────────────────────────────────────

      // 1a. ficheIds des FACTURES validées → dépistage des BCs déjà convertis
      const facturesWithFiche = await this.prisma.facture.findMany({
        where: { ...centreFilter, type: 'FACTURE', ficheId: { not: null }, ...activeStatus, ...dateFilter },
        select: { ficheId: true },
      });
      const factureFicheIds = facturesWithFiche
        .map((f) => f.ficheId)
        .filter((id): id is string => !!id);

      // 1b. Agrégation en parallèle des 3 catégories
      const [factureAgg, bcAgg, avoirAgg] = await Promise.all([
        // Factures officielles
        this.prisma.facture.aggregate({
          _sum: { totalTTC: true },
          where: { ...centreFilter, type: 'FACTURE', ...activeStatus, ...dateFilter },
        }),
        // Bons de Commande non encore facturés (déduplication DB)
        this.prisma.facture.aggregate({
          _sum: { totalTTC: true },
          where: {
            ...centreFilter,
            type: { in: ['BON_COMMANDE', 'BON_COMM'] },
            ...activeStatus,
            ficheId: { notIn: factureFicheIds },
            OR: [
              { notes: { not: { contains: 'Remplacée par' } } },
              { notes: null },
            ],
            ...dateFilter,
          },
        }),
        // Avoirs (à soustraire du CA)
        this.prisma.facture.aggregate({
          _sum: { totalTTC: true },
          where: { ...centreFilter, type: 'AVOIR', ...activeStatus, ...dateFilter },
        }),
      ]);

      // 1c. CA TTC puis dérivation HT (TVA 20%)
      const caTTC =
        (factureAgg._sum.totalTTC || 0) +
        (bcAgg._sum.totalTTC || 0) -
        (avoirAgg._sum.totalTTC || 0);
      const revenue = caTTC / 1.2; // Revenu HT garanti cohérent

      // ─────────────────────────────────────────────────────────────────────
      // ÉTAPE 2 ► COGS (Coût d'Achat des Marchandises Vendues)
      // ─────────────────────────────────────────────────────────────────────

      // 2a. Mouvements de stock réels liés aux ventes
      const cogsQuery = Prisma.sql`
        SELECT SUM(m."quantite" * COALESCE(m."prixAchatUnitaire", 0)) as total_cost
        FROM "MouvementStock" m
        JOIN "Facture" f ON m."factureId" = f."id"
        WHERE f."dateEmission" >= ${start} AND f."dateEmission" <= ${end}
          AND f."type" IN ('FACTURE', 'BON_COMMANDE')
          AND f."statut" != 'ARCHIVE'
        ${tenantId ? Prisma.sql`AND f."centreId" = ${tenantId}` : Prisma.sql``}
      `;
      const cogsResult = await this.prisma.$queryRaw<any[]>(cogsQuery);
      let rawCogs = Math.abs(Number(cogsResult[0]?.total_cost || 0));

      // 2b. BLs Verres liés via FicheId (verres commandés chez fournisseur)
      const allFicheIds = [
        ...new Set([
          ...factureFicheIds,
          ...(await this.prisma.facture.findMany({
            where: {
              ...centreFilter,
              type: { in: ['BON_COMMANDE', 'BON_COMM'] },
              ...activeStatus,
              ficheId: { notIn: factureFicheIds, not: null },
              OR: [{ notes: { not: { contains: 'Remplacée par' } } }, { notes: null }],
              ...dateFilter,
            },
            select: { ficheId: true },
          })).map((d) => d.ficheId).filter((id): id is string => !!id),
        ]),
      ];

      if (allFicheIds.length > 0) {
        const linkedBls = await this.prisma.factureFournisseur.aggregate({
          where: { ficheId: { in: allFicheIds } },
          _sum: { montantTTC: true },
        });
        rawCogs += linkedBls?._sum?.montantTTC || 0;
      }

      // 2c. Fallback : achats stock fournisseur si aucun mouvement de stock enregistré
      if (rawCogs === 0) {
        const globalCogsAgg = await this.prisma.factureFournisseur.aggregate({
          where: {
            dateEmission: { gte: start, lte: end },
            type: { in: this.INVENTORY_PURCHASE_TYPES },
            ...centreFilter,
          },
          _sum: { montantTTC: true },
        });
        rawCogs = globalCogsAgg._sum.montantTTC || 0;
      }

      // ─────────────────────────────────────────────────────────────────────
      // ÉTAPE 3 ► Dépenses opérationnelles
      // ─────────────────────────────────────────────────────────────────────
      const [expensesAgg, purchaseExpensesAgg] = await Promise.all([
        this.prisma.depense.aggregate({
          where: { date: { gte: start, lte: end }, ...centreFilter },
          _sum: { montant: true },
        }),
        this.prisma.factureFournisseur.aggregate({
          where: {
            dateEmission: { gte: start, lte: end },
            type: { notIn: this.INVENTORY_PURCHASE_TYPES },
            ...centreFilter,
          },
          _sum: { montantTTC: true },
        }),
      ]);

      const totalExpenses =
        (expensesAgg._sum.montant || 0) + (purchaseExpensesAgg._sum.montantTTC || 0);

      // ─────────────────────────────────────────────────────────────────────
      // ÉTAPE 4 ► Ventilations détaillées (breakdown)
      // ─────────────────────────────────────────────────────────────────────

      // Ventilation dépenses opé
      const [expenseBreakdown, purchaseBreakdown] = await Promise.all([
        this.prisma.depense.groupBy({
          by: ['categorie'],
          where: { date: { gte: start, lte: end }, ...centreFilter },
          _sum: { montant: true },
        }),
        this.prisma.factureFournisseur.groupBy({
          by: ['type'],
          where: {
            dateEmission: { gte: start, lte: end },
            type: { notIn: this.INVENTORY_PURCHASE_TYPES },
            ...centreFilter,
          },
          _sum: { montantTTC: true },
        }),
      ]);

      const combinedBreakdownMap = new Map<string, number>();
      expenseBreakdown.forEach((e) => {
        const key = e.categorie || 'AUTRES';
        combinedBreakdownMap.set(key, (combinedBreakdownMap.get(key) || 0) + (e._sum.montant || 0));
      });
      purchaseBreakdown.forEach((p) => {
        const key = p.type || 'AUTRES CHARGES';
        combinedBreakdownMap.set(key, (combinedBreakdownMap.get(key) || 0) + (p._sum.montantTTC || 0));
      });
      const formattedBreakdown = Array.from(combinedBreakdownMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      // Ventilation COGS par catégorie produit
      const cogsBreakdownQuery = Prisma.sql`
        SELECT p."typeArticle" as category, SUM(m."quantite" * COALESCE(m."prixAchatUnitaire", 0)) as amount
        FROM "MouvementStock" m
        JOIN "Product" p ON m."produitId" = p."id"
        JOIN "Facture" f ON m."factureId" = f."id"
        WHERE f."dateEmission" >= ${start} AND f."dateEmission" <= ${end}
          AND f."type" IN ('FACTURE', 'BON_COMMANDE')
          AND f."statut" != 'ARCHIVE'
        ${tenantId ? Prisma.sql`AND f."centreId" = ${tenantId}` : Prisma.sql``}
        GROUP BY p."typeArticle"
      `;
      const cogsBreakdownResult = await this.prisma.$queryRaw<any[]>(cogsBreakdownQuery);
      const cogsMap = new Map<string, number>();
      cogsBreakdownResult.forEach((r) => {
        const cat = r.category || 'AUTRES STOCKS';
        cogsMap.set(cat, (cogsMap.get(cat) || 0) + Math.abs(Number(r.amount || 0)));
      });
      if (allFicheIds.length > 0) {
        const linkedBlsBreakdown = await this.prisma.factureFournisseur.groupBy({
          by: ['type'],
          where: { ficheId: { in: allFicheIds } },
          _sum: { montantTTC: true },
        });
        linkedBlsBreakdown.forEach((b) => {
          const cat = b.type || 'ACHAT_VERRE_LIE';
          cogsMap.set(cat, (cogsMap.get(cat) || 0) + (b._sum.montantTTC || 0));
        });
      }
      if (cogsMap.size === 0 && rawCogs > 0) {
        const inventoryPurchases = await this.prisma.factureFournisseur.groupBy({
          by: ['type'],
          where: { dateEmission: { gte: start, lte: end }, type: { in: this.INVENTORY_PURCHASE_TYPES }, ...centreFilter },
          _sum: { montantTTC: true },
        });
        inventoryPurchases.forEach((p) => {
          cogsMap.set(p.type || 'AUTRES STOCKS', (cogsMap.get(p.type || 'AUTRES STOCKS') || 0) + (p._sum.montantTTC || 0));
        });
      }
      const formattedCogsBreakdown = Array.from(cogsMap.entries())
        .map(([category, amount]) => ({
          category,
          amount: Math.round(amount * 100) / 100,
          percentage: rawCogs > 0 ? (amount / rawCogs) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      // ─────────────────────────────────────────────────────────────────────
      // RÉSULTAT FINAL
      // ─────────────────────────────────────────────────────────────────────
      const netProfit = revenue - rawCogs - totalExpenses;

      console.log(
        `[STATS-PROFIT] CA TTC=${caTTC.toFixed(2)} | Revenu HT=${revenue.toFixed(2)} | COGS=${rawCogs.toFixed(2)} | Dépenses=${totalExpenses.toFixed(2)} | Bénéfice Net=${netProfit.toFixed(2)}`,
      );

      return {
        revenue,   // Revenu HT  (= caTTC / 1.2 → cohérent avec Contrôle des Ventes)
        caTTC,     // CA Global TTC  (= revenue × 1.2, identique à Contrôle des Ventes)
        cogs: rawCogs,
        expenses: totalExpenses,
        grossProfit: revenue - rawCogs,
        netProfit,
        expensesBreakdown: formattedBreakdown,
        cogsBreakdown: formattedCogsBreakdown,
        analysis: {
          grossMarginRate: revenue ? ((revenue - rawCogs) / revenue) * 100 : 0,
          marginRate: revenue ? (netProfit / revenue) * 100 : 0,
        },
      };
    } catch (error) {
      console.error('[Stats-Profit] Critical Error in getRealProfit:', error);
      throw error;
    }
  }

  async getProfitEvolution(
    period: 'daily' | 'monthly' = 'monthly',
    startDate?: string,
    endDate?: string,
    centreId?: string,
  ) {
    console.log(`[StatsService] getProfitEvolution called with: period=${period}, start=${startDate}, end=${endDate}`);
    try {
      const tenantId =
        centreId &&
        centreId.trim() &&
        centreId !== 'undefined' &&
        centreId !== 'null' &&
        centreId !== ''
          ? centreId
          : undefined;

      const isValidDate = (d: string | undefined | null): boolean =>
        !!(d && d !== 'undefined' && d !== 'null' && d !== '');

      let start = isValidDate(startDate) ? new Date(startDate!) : undefined;
      let end = isValidDate(endDate) ? new Date(endDate!) : undefined;

      // If no start or end, find the real bounds from data
      if (!start || !end) {
        const range = await this.prisma.facture.aggregate({
          where: {
            centreId: tenantId || undefined,
            statut: { notIn: ['ARCHIVE'] },
            type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR', 'DEVIS'] },
          },
          _min: { dateEmission: true },
          _max: { dateEmission: true },
        });
        
        if (!start) {
            start = range._min.dateEmission || new Date(new Date().getFullYear(), 0, 1);
            start.setHours(0,0,0,0);
        }
        if (!end) {
            end = range._max.dateEmission || new Date();
            end.setHours(23,59,59,999);
        }
      }

      console.log(`[StatsService] Final range for evolution: ${start.toISOString()} to ${end.toISOString()}`);

      const monthsMap = new Map<string, { revenue: number; cogs: number; expenses: number }>();

      const formatKey = (date: Date) => {
        if (period === 'daily') {
          return date.toISOString().split('T')[0];
        }
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      };

      // Fill Gaps
      const current = new Date(start);
      while (current <= end) {
        monthsMap.set(formatKey(current), { revenue: 0, cogs: 0, expenses: 0 });
        if (period === 'daily') {
          current.setDate(current.getDate() + 1);
        } else {
          current.setMonth(current.getMonth() + 1);
        }
      }

      // 1. Revenue
      const facturesRaw = await this.prisma.facture.findMany({
        where: {
          dateEmission: { gte: start, lte: end },
          statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
          type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR'] },
          ...(tenantId ? { centreId: tenantId } : {}),
        },
        select: { dateEmission: true, totalHT: true, totalTTC: true, type: true, ficheId: true, notes: true },
      });

      const facturesWithFicheIds = new Set(
        facturesRaw.filter(f => f.type === 'FACTURE' && f.ficheId).map(f => f.ficheId)
      );

      facturesRaw.forEach((f) => {
        const key = formatKey(f.dateEmission);
        if (!monthsMap.has(key)) return;

        // Skip if BC is factured/deduplicated via fiche
        const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM';
        const isFacturedViaFiche = isBC && f.ficheId && facturesWithFicheIds.has(f.ficheId);
        
        // Skip if BC is factured via notes (for anonymous clients)
        const isFacturedViaNote = isBC && f.notes?.includes('Remplacée par');

        if (isFacturedViaFiche || isFacturedViaNote) {
          return;
        }

        // Force HT calculation from TTC to ensure 20% consistency across charts
        const valTTC = f.totalTTC || 0;
        const valHT = valTTC / 1.2;
        
        const entry = monthsMap.get(key)!;
        if (f.type === 'AVOIR') entry.revenue -= valHT;
        else entry.revenue += valHT;
      });

      // 2. Expenses (Depense + Operational Purchases)
      const depenses = await this.prisma.depense.findMany({
        where: {
          date: { gte: start, lte: end },
          statut: { in: ['VALIDEE', 'VALIDÉ', 'PAYEE', 'PAYE'] },
          ...(tenantId ? { centreId: tenantId } : {}),
        },
      });
      depenses.forEach((d) => {
        const key = formatKey(d.date);
        if (!monthsMap.has(key)) return;
        monthsMap.get(key)!.expenses += d.montant || 0;
      });

      const ff = await this.prisma.factureFournisseur.findMany({
        where: {
          dateEmission: { gte: start, lte: end },
          ...(tenantId ? { centreId: tenantId } : {}),
        },
      });

      ff.forEach((f) => {
        const key = formatKey(f.dateEmission);
        if (!monthsMap.has(key)) return;
        const entry = monthsMap.get(key)!;

        const isInventory = this.INVENTORY_PURCHASE_TYPES.includes(f.type || '');
        if (isInventory) {
          entry.cogs += f.montantTTC || 0;
        } else {
          entry.expenses += f.montantTTC || 0;
        }
      });

      const sortedResult = Array.from(monthsMap.entries())
        .map(([label, vals]) => ({
          month: label,
          revenue: vals.revenue,
          expenses: vals.cogs + vals.expenses,
          cogs: vals.cogs,
          netProfit: vals.revenue - (vals.cogs + vals.expenses),
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      console.log(`[StatsService] getProfitEvolution returning ${sortedResult.length} data points`);
      return sortedResult;
    } catch (error) {
      console.error('[Stats-Profit] Evolution Error:', error);
      throw error;
    }
  }
}
