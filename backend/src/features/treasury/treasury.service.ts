import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TreasuryService {
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
    'VALIDE', 'VALIDEE', 'VALIDÉ', 'VALIDÉE', 'PAYEE', 'PAYÉ', 'PAYÉE', 'SOLDEE', 'SOLDÉ', 'SOLDÉE', 'ENCAISSE', 'ENCAISSÉ', 'ENCAISSÉE', 'PARTIEL'
  ];

  constructor(private prisma: PrismaService) { }

  async getMonthlySummary(
    year: number,
    month: number,
    centreId?: string,
    startDateStr?: string,
    endDateStr?: string,
  ) {
    let startDate: Date;
    let endDate: Date;

    if (startDateStr) {
      startDate = new Date(startDateStr);
    } else {
      startDate =
        month === 0 ? new Date(0) : new Date(Date.UTC(year, month - 1, 1));
    }

    if (endDateStr) {
      endDate = new Date(endDateStr);
    } else {
      endDate =
        month === 0
          ? new Date(3000, 0, 1)
          : new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    }

    const results = await Promise.all([
      // 0. Direct Expenses
      this.prisma.depense.groupBy({
        by: ['categorie'],
        where: {
          date: { gte: startDate, lte: endDate },
          centreId: centreId,
          echeanceId: null,
        } as any,
        _sum: { montant: true },
      }),

      // 1. Scheduled Payments (Echeances)
      this.prisma.echeancePaiement.findMany({
        where: {
          dateEcheance: { gte: startDate, lte: endDate },
          statut: { not: 'ANNULE' },
          ...(centreId
            ? {
              OR: [
                { depense: { centreId } },
                { factureFournisseur: { centreId } },
              ],
            }
            : {
              OR: [
                { depense: { isNot: null } },
                { factureFournisseur: { isNot: null } },
              ],
            }),
        },
        select: {
          montant: true,
          statut: true,
          dateEcheance: true,
          depense: { select: { id: true, categorie: true, description: true } },
          factureFournisseur: {
            select: { id: true, type: true, numeroFacture: true },
          },
        },
      }),

      // 2. Incoming Payments (Paiement)
      this.prisma.paiement.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          statut: { not: 'ANNULE' },
          facture: { ...(centreId ? { centreId } : {}) },
        },
        select: {
          montant: true,
          statut: true,
          mode: true,
          facture: { select: { type: true } },
        },
      }),

      // 3. Global Pending Incomings (Standard)
      this.prisma.paiement.aggregate({
        where: {
          statut: 'EN_ATTENTE',
          facture: {
            type: { not: 'AVOIR' },
            ...(centreId ? { centreId } : {}),
          },
        },
        _sum: { montant: true },
      }),

      // 4. Global Pending Incomings (Avoir)
      this.prisma.paiement.aggregate({
        where: {
          statut: 'EN_ATTENTE',
          facture: { type: 'AVOIR', ...(centreId ? { centreId } : {}) },
        },
        _sum: { montant: true },
      }),

      // 5. Configuration
      this.prisma.financeConfig.findFirst(),

      // 6. Total Invoices for the period (Alignment with Stats)
      this.prisma.factureFournisseur.aggregate({
        where: {
          dateEmission: { gte: startDate, lte: endDate },
          ...(centreId ? { centreId } : {}),
        },
        _sum: { montantTTC: true },
      }),

      // 7. Total Direct Expenses for the period (Alignment with Stats)
      this.prisma.depense.aggregate({
        where: {
          date: { gte: startDate, lte: endDate },
          ...(centreId ? { centreId } : {}),
        },
        _sum: { montant: true },
      }),

      // 8. Invoice Breakdown by Type
      this.prisma.factureFournisseur.groupBy({
        by: ['type'],
        where: {
          dateEmission: { gte: startDate, lte: endDate },
          ...(centreId ? { centreId } : {}),
        },
        _sum: { montantTTC: true },
      }),
    ]);

    const directExpenseCategories = results[0] as any[];
    const monthlyEcheances = results[1] as any[];
    const monthlyPaiements = results[2] as any[];
    const incomingPendingStandard = (results[3] as any)._sum.montant || 0;
    const incomingPendingAvoir = (results[4] as any)._sum.montant || 0;
    const config = results[5] as any;
    const totalInvoicesTTC = (results[6] as any)._sum.montantTTC || 0;
    const totalDirectExpensesValue = (results[7] as any)._sum.montant || 0;
    const invoiceBreakdown = results[8] as any[];

    const monthlyThreshold = config?.monthlyThreshold || 50000;

    const inventoryTypes = this.INVENTORY_PURCHASE_TYPES;
    const operationalTypes = this.OPERATIONAL_PURCHASE_TYPES;
    const combinedCategoriesMap = new Map<string, number>();

    // 1. Process Invoice Categories (Alignment with Stats)
    invoiceBreakdown.forEach((b) => {
      const type = b.type || 'AUTRE';
      const isInventory = inventoryTypes.includes(type);
      const isOperational = operationalTypes.includes(type);

      // We count all supplier invoices to be consistent with getRealProfit 
      // which uses the same "all for operational + all for inventory" logic.
      const amount = Number(b._sum.montantTTC || 0);
      let cat = type;
      if (isInventory) {
        if (type === 'ACHAT MONTURES OPTIQUES') cat = 'ACHAT MONTURES';
        else if (type === 'ACHAT VERRES OPTIQUES') cat = 'ACHAT VERRES';
        else if (type === 'ACHAT LENTILLES DE CONTACT') cat = 'ACHAT LENTILLES';
        else if (type === 'ACHAT ACCESSOIRES OPTIQUES') cat = 'ACHAT ACCESSOIRES';
        else cat = 'ACHAT STOCK (Divers)';
      }

      combinedCategoriesMap.set(
        cat,
        (combinedCategoriesMap.get(cat) || 0) + amount,
      );
    });

    // 2. Process Direct Expense Categories
    directExpenseCategories.forEach((c) => {
      const amount = Number(c._sum.montant || 0);
      const cat = c.categorie || 'AUTRES FRAIS';
      combinedCategoriesMap.set(
        cat,
        (combinedCategoriesMap.get(cat) || 0) + amount,
      );
    });

    // Total Expenses is strictly Invoice-based (Accrual) for header consistency
    const totalExpenses = totalInvoicesTTC + totalDirectExpensesValue;

    // 3. Process Scheduled Payments (Echeances) - FOR CASH FLOW ONLY
    let totalScheduledCashed = 0;
    let totalOutgoingPending = 0;

    monthlyEcheances.forEach((e) => {
      const type = e.factureFournisseur?.type;
      const isInventory = inventoryTypes.includes(type);
      const isOperational = operationalTypes.includes(type);

      // Only count installments related to valid invoice/expense types
      if (e.factureFournisseur && !isInventory && !isOperational) return;

      const amount = Number(e.montant || 0);
      const isCashed = ['ENCAISSE', 'DECAISSE', 'PAYE', 'PAYÉ', 'PAYEE', 'PAYÉE', 'SOLDE'].includes(e.statut?.toUpperCase());

      if (e.statut === 'EN_ATTENTE') {
        totalOutgoingPending += amount;
      } else if (isCashed) {
        totalScheduledCashed += amount;
      }
    });

    // 3. Process Incoming Payments (Paiement)
    let incomingStandard = 0;
    let incomingAvoir = 0;
    let incomingCashedStandard = 0;
    let incomingCashedAvoir = 0;
    let incomingCash = 0;
    let incomingCard = 0;
    let countCard = 0;

    const cashedStatuses = ['ENCAISSE', 'DECAISSE', 'DECAISSEMENT', 'PAYE', 'PAYÉ', 'PAYEE', 'PAYÉE', 'SOLDE', 'ENCAISSÉ'];

    monthlyPaiements.forEach((p) => {
      const amount = Number(p.montant || 0);
      const isAvoir = p.facture?.type === 'AVOIR';
      const isCashed = cashedStatuses.includes(p.statut?.toUpperCase());

      // Harmonize modes
      const mode = (p.mode || '').toUpperCase();
      const isCashMode =
        ['ESPECES', 'LIQUIDE', 'CASH', 'ESPÈCES'].includes(mode);
      const isCardMode =
        ['CARTE', 'CARTE BANCAIRE', 'CB', 'TPE'].includes(mode);

      if (isAvoir) {
        incomingAvoir += amount;
        if (isCashed) {
          incomingCashedAvoir += amount;
          if (isCashMode) incomingCash -= amount;
          if (isCardMode) incomingCard -= amount;
        }
      } else {
        incomingStandard += amount;
        if (isCashed) {
          incomingCashedStandard += amount;
          if (isCashMode) incomingCash += amount;
          if (isCardMode) {
            incomingCard += amount;
            countCard++;
          }
        }
      }
    });

    const totalIncoming = incomingStandard - incomingAvoir;
    const totalIncomingCashed = incomingCashedStandard - incomingCashedAvoir;

    // totalExpensesCashed includes paid installments + paid direct expenses
    const totalExpensesCashed = totalScheduledCashed + totalDirectExpensesValue;

    const balance = totalIncoming - totalExpenses;
    const balanceReal = totalIncomingCashed - totalExpensesCashed;

    const categories = Array.from(combinedCategoriesMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const alerts = await this.getPendingAlerts(centreId);

    const countChequeCoffre = monthlyPaiements.filter(
      (p) => p.statut === 'EN_ATTENTE' && ['CHEQUE', 'LCN'].includes(p.mode),
    ).length;

    return {
      month,
      year,
      totalExpenses,
      totalIncoming,
      totalExpensesCashed,
      totalIncomingCashed,
      balance,
      balanceReal,
      totalScheduled: totalInvoicesTTC + totalDirectExpensesValue, // Unified planned total
      totalIncomingPending: incomingPendingStandard - incomingPendingAvoir,
      totalOutgoingPending,
      monthlyThreshold,
      categories,
      incomingCash,
      incomingCard,
      countCard,
      countChequeCoffre,
      alerts,
    };
  }

  async getConfig() {
    let config = await this.prisma.financeConfig.findFirst();
    if (!config) {
      config = await this.prisma.financeConfig.create({
        data: { monthlyThreshold: 50000 },
      });
    }
    return config;
  }

  async updateConfig(threshold: number) {
    const config = await this.getConfig();
    return this.prisma.financeConfig.update({
      where: { id: config.id },
      data: { monthlyThreshold: threshold },
    });
  }

  async getConsolidatedOutgoings(filters: {
    fournisseurId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    source?: string;
    centreId?: string;
    mode?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const skip = (page - 1) * limit;

    if (
      filters.mode &&
      (filters.mode.includes('CHEQUE') ||
        filters.mode.includes('LCN') ||
        filters.mode.includes('VIREMENT') ||
        filters.mode.includes('ESPECES'))
    ) {
      const where: any = {};
      if (filters.mode !== 'ALL') where.type = { in: filters.mode.split(',') };
      where.statut = { not: 'ANNULE' };

      if (filters.startDate || filters.endDate) {
        const dateRange: any = {};
        if (filters.startDate) dateRange.gte = new Date(filters.startDate);
        if (filters.endDate) dateRange.lte = new Date(filters.endDate);
        where.dateEcheance = dateRange;
      }

      if (filters.centreId) {
        where.OR = [
          { factureFournisseur: { centreId: filters.centreId } },
          { depense: { centreId: filters.centreId } },
        ];
      }

      const [pieces, total, aggregate, inHandAgg, depositedAgg, paidAgg] = await Promise.all([
        this.prisma.echeancePaiement.findMany({
          where,
          include: {
            factureFournisseur: { include: { fournisseur: { select: { nom: true } } } },
            depense: { include: { fournisseur: { select: { nom: true } } } },
            bonLivraison: { include: { fournisseur: { select: { nom: true } } } },
          },
          orderBy: { dateEcheance: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.echeancePaiement.count({ where }),
        this.prisma.echeancePaiement.aggregate({ where, _sum: { montant: true } }),
        this.prisma.echeancePaiement.aggregate({ 
          where: { ...where, statut: { in: ['EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS', 'BROUILLON'] } }, 
          _sum: { montant: true } 
        }),
        this.prisma.echeancePaiement.aggregate({ 
          where: { ...where, statut: { in: ['REMIS_EN_BANQUE', 'DEPOSE', 'DÉPOSÉ'] } }, 
          _sum: { montant: true } 
        }),
        this.prisma.echeancePaiement.aggregate({ 
          where: { ...where, statut: { in: ['ENCAISSE', 'PAYE', 'PAYÉ', 'VALIDE', 'VALIDÉ'] } }, 
          _sum: { montant: true } 
        })
      ]);

      return {
        data: pieces.map((p) => ({
          id: p.id,
          date: p.dateEcheance,
          libelle: p.factureFournisseur?.numeroFacture || p.bonLivraison?.numeroBL || p.depense?.description || p.depense?.categorie || 'N/A',
          type: p.type,
          fournisseur: p.factureFournisseur?.fournisseur?.nom || p.bonLivraison?.fournisseur?.nom || p.depense?.fournisseur?.nom || 'N/A',
          montant: p.montant,
          statut: p.statut,
          source: p.factureFournisseur ? 'FACTURE' : (p.bonLivraison ? 'BL' : 'DEPENSE'),
          modePaiement: p.type,
          reference: p.reference,
          banque: p.banque,
          dateEcheance: p.dateEcheance,
          dateEncaissement: p.dateEncaissement,
          createdAt: p.createdAt,
        })),
        total,
        subtotals: { 
          totalTTC: aggregate._sum.montant || 0,
          inHand: inHandAgg._sum.montant || 0,
          deposited: depositedAgg._sum.montant || 0,
          paid: paidAgg._sum.montant || 0
        }
      };
    }

    let depenseWhere = `WHERE 1=1 `;
    let echeanceWhere = `WHERE 1=1 `; // For FactureFournisseur
    let blEcheanceWhere = `WHERE 1=1 `; // NEW branch for BonLivraison
    const sqlParams: any[] = [];

    if (filters.centreId) {
      sqlParams.push(filters.centreId);
      depenseWhere += `AND d."centreId" = $${sqlParams.length} `;
      echeanceWhere += `AND ff."centreId" = $${sqlParams.length} `;
      blEcheanceWhere += `AND bl."centreId" = $${sqlParams.length} `;
    }
    if (filters.fournisseurId) {
      sqlParams.push(filters.fournisseurId);
      depenseWhere += `AND d."fournisseurId" = $${sqlParams.length} `;
      echeanceWhere += `AND ff."fournisseurId" = $${sqlParams.length} `;
      blEcheanceWhere += `AND bl."fournisseurId" = $${sqlParams.length} `;
    }
    if (filters.type) {
      sqlParams.push(filters.type);
      depenseWhere += `AND d.categorie = $${sqlParams.length} `;
      echeanceWhere += `AND ff.type = $${sqlParams.length} `;
      blEcheanceWhere += `AND bl.type = $${sqlParams.length} `;
    }
    if (filters.startDate) {
      sqlParams.push(new Date(filters.startDate));
      depenseWhere += `AND COALESCE(d."dateEcheance", d.date) >= $${sqlParams.length} `;
      echeanceWhere += `AND ep."dateEcheance" >= $${sqlParams.length} `;
      blEcheanceWhere += `AND ep."dateEcheance" >= $${sqlParams.length} `;
    }
    if (filters.endDate) {
      sqlParams.push(new Date(filters.endDate));
      depenseWhere += `AND COALESCE(d."dateEcheance", d.date) <= $${sqlParams.length} `;
      echeanceWhere += `AND ep."dateEcheance" <= $${sqlParams.length} `;
      blEcheanceWhere += `AND ep."dateEcheance" <= $${sqlParams.length} `;
    }
    if (filters.source === 'FACTURE') {
      depenseWhere += `AND 1=0 `;
      blEcheanceWhere += `AND 1=0 `;
    }
    if (filters.source === 'DEPENSE') {
      echeanceWhere += `AND 1=0 `;
      blEcheanceWhere += `AND 1=0 `;
    }

    const baseQuery = `
      SELECT 
        d.id, d.date, COALESCE(d.description, d.categorie) as libelle, d.categorie as type, 
        COALESCE(f.nom, ff_d.nom, 'N/A') as fournisseur, d.montant, d.statut, 'DEPENSE' as source, 
        'DEPENSE' as "sourceRaw", d."modePaiement", d.reference, ep_d.banque, d."dateEcheance", 
        ep_d."dateEncaissement", d.montant as "montantHT", NULL as "echeanceId"
      FROM "Depense" d
      LEFT JOIN "Fournisseur" f ON d."fournisseurId" = f.id
      LEFT JOIN "FactureFournisseur" inv_d ON d."factureFournisseurId" = inv_d.id
      LEFT JOIN "Fournisseur" ff_d ON inv_d."fournisseurId" = ff_d.id
      LEFT JOIN "EcheancePaiement" ep_d ON d."echeanceId" = ep_d.id
      ${depenseWhere}
      UNION ALL
      SELECT 
        ff.id, ep."dateEcheance" as date, ff."numeroFacture" || ' (' || ep.type || ')' as libelle, 
        ff.type as type, COALESCE(f_ff.nom, 'N/A') as fournisseur, ep.montant, ep.statut, 
        'Facture ' || ff."numeroFacture" as source, 'FACTURE' as "sourceRaw",
        ep.type as "modePaiement", COALESCE(ep.reference, ff."numeroFacture") as reference, 
        ep.banque, ep."dateEcheance", ep."dateEncaissement", ff."montantHT", ep.id as "echeanceId"
      FROM "EcheancePaiement" ep
      INNER JOIN "FactureFournisseur" ff ON ep."factureFournisseurId" = ff.id
      LEFT JOIN "Fournisseur" f_ff ON ff."fournisseurId" = f_ff.id
      ${echeanceWhere}
      AND NOT EXISTS (SELECT 1 FROM "Depense" d_idx WHERE d_idx."echeanceId" = ep.id)
      UNION ALL
      SELECT 
        bl.id, ep."dateEcheance" as date, bl."numeroBL" || ' (' || ep.type || ')' as libelle, 
        bl.type as type, COALESCE(f_bl.nom, 'N/A') as fournisseur, ep.montant, ep.statut, 
        'BL ' || bl."numeroBL" as source, 'BL' as "sourceRaw",
        ep.type as "modePaiement", COALESCE(ep.reference, bl."numeroBL") as reference, 
        ep.banque, ep."dateEcheance", ep."dateEncaissement", bl."montantTTC" as "montantHT", ep.id as "echeanceId"
      FROM "EcheancePaiement" ep
      INNER JOIN "BonLivraison" bl ON ep."bonLivraisonId" = bl.id
      LEFT JOIN "Fournisseur" f_bl ON bl."fournisseurId" = f_bl.id
      ${blEcheanceWhere}
      AND NOT EXISTS (SELECT 1 FROM "Depense" d_idx WHERE d_idx."echeanceId" = ep.id)
    `;

    const statsQuery = `
      SELECT 
        COUNT(*)::int as total, 
        COALESCE(SUM(montant), 0)::float as "totalTTC",
        COALESCE(SUM(CASE WHEN statut IN ('EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS', 'BROUILLON', 'NON_PAYEE', 'A_PAYER') THEN montant ELSE 0 END), 0)::float as "inHand",
        COALESCE(SUM(CASE WHEN statut IN ('REMIS_EN_BANQUE', 'DEPOSE', 'DÉPOSÉ') THEN montant ELSE 0 END), 0)::float as "deposited",
        COALESCE(SUM(CASE WHEN statut IN ('ENCAISSE', 'PAYE', 'PAYÉ', 'VALIDE', 'VALIDÉ') THEN montant ELSE 0 END), 0)::float as "paid"
      FROM (${baseQuery}) as c
    `;
    const stats = await this.prisma.$queryRawUnsafe<any[]>(statsQuery, ...sqlParams);

    const dataQuery = `${baseQuery} ORDER BY date DESC LIMIT ${limit} OFFSET ${skip}`;
    const results = await this.prisma.$queryRawUnsafe<any[]>(dataQuery, ...sqlParams);

    const mappedData = results.map(r => ({
      ...r,
      montant: Number(r.montant || 0),
      montantHT: Number(r.montantHT || r.montant || 0)
    }));

    // Accrual Total for Dashboard Alignment
    const [accrualFactureAgg, accrualDepenseAgg] = await Promise.all([
      this.prisma.factureFournisseur.aggregate({
        where: {
          centreId: filters.centreId,
          ...(filters.startDate || filters.endDate ? {
            dateEmission: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {})
            }
          } : {}),
          ...(filters.fournisseurId ? { fournisseurId: filters.fournisseurId } : {}),
        },
        _sum: { montantTTC: true, montantHT: true }
      }),
      this.prisma.depense.aggregate({
        where: {
          centreId: filters.centreId,
          ...(filters.startDate || filters.endDate ? {
            date: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {})
            }
          } : {}),
          ...(filters.fournisseurId ? { fournisseurId: filters.fournisseurId } : {}),
        },
        _sum: { montant: true }
      })
    ]);

    const totalAccrual = (accrualFactureAgg._sum.montantTTC || 0) + (accrualDepenseAgg._sum.montant || 0);
    const totalHT = (accrualFactureAgg._sum.montantHT || 0) + (accrualDepenseAgg._sum.montant || 0);

    return {
      data: mappedData,
      total: stats[0]?.total || 0,
      subtotals: {
        totalTTC: stats[0]?.totalTTC || 0,
        inHand: stats[0]?.inHand || 0,
        deposited: stats[0]?.deposited || 0,
        paid: stats[0]?.paid || 0,
        totalAccrual: Number(totalAccrual.toFixed(2)),
        totalHT: Number(totalHT.toFixed(2))
      }
    };
  }

  async getConsolidatedIncomings(filters: {
    centreId?: string;
    clientId?: string;
    type?: string;
    statut?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    let whereClause = `WHERE 1=1 `;
    const sqlParams: any[] = [];

    if (filters.centreId) {
      sqlParams.push(filters.centreId);
      whereClause += `AND f."centreId" = $${sqlParams.length} `;
    }
    if (filters.clientId) {
      sqlParams.push(filters.clientId);
      whereClause += `AND f."clientId" = $${sqlParams.length} `;
    }
    if (filters.statut && filters.statut !== 'ALL') {
      sqlParams.push(filters.statut);
      whereClause += `AND p.statut = $${sqlParams.length} `;
    }
    if (filters.type && filters.type !== 'ALL') {
      const types = filters.type.split(',').map(t => t.trim());
      const inClause = types.map((_, i) => `$${sqlParams.length + i + 1}`).join(', ');
      types.forEach(t => sqlParams.push(t));
      whereClause += `AND p.mode IN (${inClause}) `;
    }
    if (filters.startDate) {
      sqlParams.push(new Date(filters.startDate));
      whereClause += `AND p.date >= $${sqlParams.length} `;
    }
    if (filters.endDate) {
      sqlParams.push(new Date(filters.endDate));
      whereClause += `AND p.date <= $${sqlParams.length} `;
    }

    const baseQuery = `
      FROM "Paiement" p
      INNER JOIN "Facture" f ON p."factureId" = f.id
      INNER JOIN "Client" c ON f."clientId" = c.id
      ${whereClause}
    `;

    const statsQuery = `
      SELECT 
        COUNT(*)::int as total, 
        COALESCE(SUM(p.montant), 0)::float as "totalTTC",
        COALESCE(SUM(CASE WHEN p.statut IN ('EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS', 'BROUILLON') THEN p.montant ELSE 0 END), 0)::float as "inHand",
        COALESCE(SUM(CASE WHEN p.statut IN ('REMIS_EN_BANQUE', 'DEPOSE', 'DÉPOSÉ') THEN p.montant ELSE 0 END), 0)::float as "deposited",
        COALESCE(SUM(CASE WHEN p.statut IN ('ENCAISSE', 'PAYE', 'PAYÉ', 'VALIDE', 'VALIDÉ') THEN p.montant ELSE 0 END), 0)::float as "paid"
      ${baseQuery}
    `;
    const [stats] = await this.prisma.$queryRawUnsafe<any[]>(statsQuery, ...sqlParams);

    const dataQuery = `
      SELECT 
        p.id, p.date, f.numero as libelle, p.mode as type, 
        c.nom || ' ' || COALESCE(c.prenom, '') as fournisseur, p.montant, p.statut, 
        'FACTURE_CLIENT' as source, p.mode as "modePaiement", p.reference, p.banque, 
        p."dateVersement" as "dateEcheance", p."dateVersement" as "dateEncaissement", 
        f."totalTTC" as "montantHT"
      ${baseQuery}
      ORDER BY p.date DESC LIMIT ${limit} OFFSET ${skip}
    `;
    const results = await this.prisma.$queryRawUnsafe<any[]>(dataQuery, ...sqlParams);

    return {
      data: results.map(r => ({ ...r, montant: Number(r.montant) })),
      total: stats.total,
      subtotals: { 
        totalTTC: stats.totalTTC,
        inHand: stats.inHand,
        deposited: stats.deposited,
        paid: stats.paid
      }
    };
  }

  async getConsolidatedUnpaid(filters: {
    centreId?: string;
    clientId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    if (!filters.centreId) {
      return { data: [], total: 0, subtotals: { totalTTC: 0, totalReste: 0 } };
    }

    const dateFilter = (filters.startDate || filters.endDate) ? {
      dateEmission: {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
      }
    } : {};

    // 1. Get ficheIds of real Factures to avoid double counting BCs (same as SalesControlService)
    const facturesWithFiche = await this.prisma.facture.findMany({
      where: {
        centreId: filters.centreId,
        type: 'FACTURE',
        ficheId: { not: null },
        ...dateFilter,
      },
      select: { ficheId: true },
    });
    const factureFicheIds = facturesWithFiche.map(f => f.ficheId).filter((id): id is string => !!id);

    // 2. Build the exact where clauses for aggregation (matching SalesControlService)
    const baseWhere: any = {
      centreId: filters.centreId,
      statut: { notIn: ['ANNULEE', 'ARCHIVE'] },
      ...dateFilter,
    };
    if (filters.clientId) baseWhere.clientId = filters.clientId;

    // For the list view, we only want rows that still have a balance
    const listWhere = {
      ...baseWhere,
      resteAPayer: { gt: 0.01 },
      OR: [
        { type: 'FACTURE' },
        { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, ficheId: { notIn: factureFicheIds } }
      ]
    };

    const where = {
      OR: [
        { ...baseWhere, type: 'FACTURE' },
        { ...baseWhere, type: { in: ['BON_COMMANDE', 'BON_COMM'] }, ficheId: { notIn: factureFicheIds } }
      ]
    };

    console.log(`[TREASURY-SERV] getConsolidatedUnpaid internal (Combined Query)`);

    // 3 parallel aggregates to match SalesControl exactly
    const [factureAgg, bcAgg, avoirAgg, data] = await Promise.all([
      this.prisma.facture.aggregate({
        where: { ...baseWhere, type: 'FACTURE' },
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true }
      }),
      this.prisma.facture.aggregate({
        where: { ...baseWhere, type: { in: ['BON_COMMANDE', 'BON_COMM'] }, ficheId: { notIn: factureFicheIds } },
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true }
      }),
      this.prisma.facture.aggregate({
        where: { ...baseWhere, type: 'AVOIR' },
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true }
      }),
      this.prisma.facture.findMany({
        where: listWhere,
        include: { client: { select: { nom: true, prenom: true, raisonSociale: true } } },
        orderBy: { dateEmission: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalTTC = (factureAgg._sum.totalTTC || 0) + (bcAgg._sum.totalTTC || 0) - (avoirAgg._sum.totalTTC || 0);
    const totalReste = (factureAgg._sum.resteAPayer || 0) + (bcAgg._sum.resteAPayer || 0) - (avoirAgg._sum.resteAPayer || 0);
    const totalCount = factureAgg._count._all + bcAgg._count._all + avoirAgg._count._all;

    console.log(`[TREASURY-SERV] Final Aggregates:`, { totalTTC, totalReste, totalCount });

    return {
      data: data.map(f => ({
        id: f.id,
        date: f.dateEmission || f.createdAt,
        libelle: `Facture ${f.numero}`,
        numero: f.numero,
        type: f.type,
        client: f.client,
        totalTTC: Number(f.totalTTC || 0),
        resteAPayer: Number(f.resteAPayer || 0),
        statut: f.statut,
        source: 'FACTURE_CLIENT',
      })),
      total: totalCount,
      subtotals: {
        totalTTC: Number(totalTTC.toFixed(2)),
        totalReste: Number(totalReste.toFixed(2)),
      },
    };
  }

  async getYearlyProjection(year: number, centreId?: string) {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const results = await Promise.all(months.map(month => {
      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      return this.prisma.echeancePaiement.aggregate({
        where: {
          dateEcheance: { gte: startDate, lte: endDate },
          statut: { not: 'ANNULE' },
          ...(centreId ? { OR: [{ depense: { centreId } }, { factureFournisseur: { centreId } }] } : { OR: [{ depense: { isNot: null } }, { factureFournisseur: { isNot: null } }] }),
        },
        _sum: { montant: true },
      });
    }));

    return results.map((res, i) => ({ month: i + 1, totalExpenses: Number((res as any)._sum.montant || 0) }));
  }

  async updateEcheanceStatus(id: string, statut: string) {
    const data: any = { statut };
    if (statut === 'ENCAISSE' || statut === 'PAYE') data.dateEncaissement = new Date();
    
    try {
      return await this.prisma.echeancePaiement.update({ where: { id }, data });
    } catch (error) {
      console.error(`[TREASURY-SERV] Error updating echeance ${id}:`, error.message);
      throw new Error(`Échéance introuvable ou erreur de mise à jour (${error.message})`);
    }
  }

  async getPendingAlerts(centreId?: string) {
    const next24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const next48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [clientAlerts, supplierAlerts] = await Promise.all([
      this.prisma.paiement.findMany({
        where: { mode: 'CHEQUE', statut: 'EN_ATTENTE', dateVersement: { lte: next24h, gte: last30days }, facture: centreId ? { centreId } : {} },
        include: { facture: { include: { client: { select: { nom: true, prenom: true } } } } },
      }),
      this.prisma.echeancePaiement.findMany({
        where: {
          type: { in: ['CHEQUE', 'LCN'] },
          statut: 'EN_ATTENTE',
          dateEcheance: { lte: next48h, gte: last30days },
          ...(centreId ? { OR: [{ depense: { centreId } }, { factureFournisseur: { centreId } }] } : { OR: [{ depense: { isNot: null } }, { factureFournisseur: { isNot: null } }] }),
        },
        include: { factureFournisseur: { include: { fournisseur: { select: { nom: true } } } }, depense: { include: { fournisseur: { select: { nom: true } } } } },
      }),
    ]);

    return {
      client: clientAlerts.map(p => ({ id: p.id, client: `${p.facture.client?.nom || ''} ${p.facture.client?.prenom || ''}`.trim(), montant: p.montant, date: p.dateVersement, reference: p.reference, numeroFacture: p.facture.numero })),
      supplier: supplierAlerts.map((e: any) => ({ id: e.id, fournisseur: e.factureFournisseur?.fournisseur?.nom || e.depense?.fournisseur?.nom || 'N/A', montant: e.montant, date: e.dateEcheance, reference: e.reference, source: e.factureFournisseur ? 'FACTURE' : 'DEPENSE' })),
    };
  }
}
