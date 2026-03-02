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
      const cat = isInventory ? 'ACHAT STOCK' : type;
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

  async getConsolidatedIncomings(filters: {
    clientId?: string;
    startDate?: string;
    endDate?: string;
    centreId?: string;
    mode?: string;
  }) {
    const where: any = {
      statut: { not: 'ANNULE' },
    };

    if (filters.mode) {
      const modes = filters.mode.split(',');
      where.mode = { in: modes };
    }

    if (filters.centreId) {
      where.facture = { centreId: filters.centreId };
    }

    if (filters.clientId) {
      where.facture = { ...where.facture, clientId: filters.clientId };
    }

    if (filters.startDate || filters.endDate) {
      const dateRange: any = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        dateRange.gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateRange.lte = end;
      }
      where.date = dateRange;
    }

    console.log('[TREASURY-INCOMINGS] Filters:', filters);
    console.log('[TREASURY-INCOMINGS] Where:', JSON.stringify(where, null, 2));

    const startTime = Date.now();
    const payments = await this.prisma.paiement.findMany({
      where,
      include: {
        facture: {
          include: {
            client: { select: { nom: true, prenom: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    console.log(
      `[TREASURY-INCOMINGS] Query took ${Date.now() - startTime}ms. Found ${payments.length} records.`,
    );

    return payments.map((p) => {
      const isAvoir = p.facture.type === 'AVOIR';
      const adjustedMontant = isAvoir ? -p.montant : p.montant;

      return {
        id: p.id,
        factureId: p.factureId,
        date: p.date,
        libelle: `Paiement ${p.facture.numero}${isAvoir ? ' (AVOIR)' : ''}`,
        type: p.mode,
        client:
          `${p.facture.client?.nom || ''} ${p.facture.client?.prenom || ''}`.trim() ||
          'N/A',
        montant: adjustedMontant,
        montantBrut: p.montant,
        statut: p.statut,
        source: 'FACTURE_CLIENT',
        modePaiement: p.mode,
        reference: p.reference,
        dateVersement: p.dateVersement, // Planned date
        dateEncaissement: p.dateEncaissement, // Actual date
        banque: p.banque,
        isAvoir,
      };
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
    statut?: string;
  }) {
    const startTime = Date.now();
    // If mode (CHEQUE, LCN, VIREMENT, ESPECES) is provided, we fetch individual pieces (EcheancePaiement)
    // If 'ALL' is provided or no mode is strictly 'FACTURE'/'DEPENSE' source, we consider Echeances as the primary view for Portfolio
    if (
      filters.mode &&
      (filters.mode.includes('CHEQUE') ||
        filters.mode.includes('LCN') ||
        filters.mode.includes('VIREMENT') ||
        filters.mode.includes('ESPECES'))
    ) {
      const where: any = {};

      if (filters.mode !== 'ALL') {
        where.type = { in: filters.mode.split(',') };
      }

      if (filters.statut && filters.statut !== 'ALL') {
        where.statut = filters.statut;
      } else {
        where.statut = { not: 'ANNULE' };
      }

      if (filters.startDate || filters.endDate) {
        const dateRange: any = {};
        if (filters.startDate) dateRange.gte = new Date(filters.startDate);
        if (filters.endDate) dateRange.lte = new Date(filters.endDate);
        where.dateEcheance = dateRange;
      }

      if (filters.centreId) {
        where.OR = [
          {
            factureFournisseur: {
              centreId: filters.centreId,
            },
          },
          { depense: { centreId: filters.centreId } },
        ];
      } else {
        where.OR = [
          { factureFournisseur: { isNot: null } },
          { depense: { isNot: null } },
        ];
      }

      const pieces = await this.prisma.echeancePaiement.findMany({
        where,
        include: {
          factureFournisseur: {
            include: { fournisseur: { select: { nom: true } } },
          },
          depense: { include: { fournisseur: { select: { nom: true } } } },
        },
        orderBy: { dateEcheance: 'desc' },
      });

      return pieces.map((p) => ({
        id: p.id,
        date: p.dateEcheance,
        libelle:
          p.factureFournisseur?.numeroFacture ||
          p.depense?.description ||
          p.depense?.categorie ||
          'N/A',
        type: p.type,
        fournisseur:
          p.factureFournisseur?.fournisseur?.nom ||
          p.depense?.fournisseur?.nom ||
          'N/A',
        montant: p.montant,
        statut: p.statut,
        source: p.factureFournisseur ? 'FACTURE' : 'DEPENSE',
        modePaiement: p.type,
        reference: p.reference,
        banque: p.banque,
        dateEcheance: p.dateEcheance, // Valeur
        dateEncaissement: p.dateEncaissement, // Actual
        createdAt: p.createdAt, // Creation date
      }));
    }

    // Default behavior (group by invoice/expense)
    const whereExpense: any = filters.centreId
      ? { centreId: filters.centreId }
      : {};
    const whereInvoice: any = filters.centreId
      ? { centreId: filters.centreId }
      : {};

    if (filters.fournisseurId) {
      whereExpense.OR = [
        { fournisseurId: filters.fournisseurId },
        { factureFournisseur: { fournisseurId: filters.fournisseurId } },
      ];
      whereInvoice.fournisseurId = filters.fournisseurId;
    }

    if (filters.type) {
      whereExpense.categorie = filters.type;
      whereInvoice.type = filters.type;
    }

    const dateRange: any = {};
    if (filters.startDate || filters.endDate) {
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        dateRange.gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateRange.lte = end;
      }
      whereExpense.OR = [{ date: dateRange }, { dateEcheance: dateRange }];
      // We will apply dateRange to echeancePaiement.dateEcheance directly later
    }

    const [expenses, invoiceEcheances] = await Promise.all([
      filters.source === 'FACTURE'
        ? Promise.resolve([])
        : this.prisma.depense.findMany({
          where: whereExpense,
          include: {
            fournisseur: { select: { nom: true } },
            factureFournisseur: {
              include: { fournisseur: { select: { nom: true } } },
            },
            echeance: {
              select: { id: true, banque: true, dateEncaissement: true },
            },
          },
          orderBy: { date: 'desc' },
        }),
      filters.source === 'DEPENSE'
        ? Promise.resolve([])
        : this.prisma.echeancePaiement.findMany({
          where: {
            factureFournisseur: {
              ...whereInvoice,
            },
            depense: null, // Deduplicate: if an echeance has a depense, it is already shown in the expenses query
            ...(Object.keys(dateRange).length > 0
              ? { dateEcheance: dateRange }
              : {}),
          },
          include: {
            factureFournisseur: {
              include: { fournisseur: { select: { nom: true } } },
            },
          },
          orderBy: { dateEcheance: 'desc' },
        }),
    ]);
    console.log(
      `[TREASURY-OUTGOINGS] Dual query took ${Date.now() - startTime}ms. Found ${expenses.length} expenses and ${invoiceEcheances.length} invoice installments.`,
    );

    const consolidated = [
      ...expenses.map((e) => ({
        id: e.id,
        date: e.date,
        libelle: e.description || e.categorie,
        type: e.categorie,
        fournisseur:
          e.fournisseur?.nom || e.factureFournisseur?.fournisseur?.nom || 'N/A',
        montant: Number(e.montant),
        statut: e.statut,
        source: 'DEPENSE',
        modePaiement: e.modePaiement,
        reference: e.reference,
        banque: e.echeance?.banque || null,
        dateEcheance: e.dateEcheance,
        dateEncaissement: e.echeance?.dateEncaissement || null,
        montantHT: null,
      })),
      ...invoiceEcheances.map((e) => ({
        id: e.factureFournisseur.id, // Keep invoice ID for frontend actions (Modifier/Supprimer)
        echeanceId: e.id, // Specific ID for this row
        date: e.dateEcheance, // Use echeance date as the primary date in the list
        libelle: `${e.factureFournisseur.numeroFacture} (${e.type})`,
        type: e.factureFournisseur.type,
        fournisseur: e.factureFournisseur.fournisseur.nom,
        montant: Number(e.montant),
        statut: e.statut,
        source: 'FACTURE',
        modePaiement: e.type,
        reference: e.reference || e.factureFournisseur.numeroFacture,
        dateEcheance: e.dateEcheance,
        dateEncaissement: e.dateEncaissement,
        montantHT: null, // We don't show HT for individual installments usually
      })),
    ];

    return consolidated.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  async getYearlyProjection(year: number, centreId?: string) {
    const startTime = Date.now();
    // User requested that "Santé Financière" (yearly graph) only tracks
    // scheduled bank outflows (echeances) and NOT instant cash expenses.

    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const monthlyQueries = months.map((month) => {
      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      return this.prisma.echeancePaiement.aggregate({
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
        _sum: { montant: true },
      });
    });

    const results = await Promise.all(monthlyQueries);

    const monthlyData = results.map((res, i) => ({
      month: i + 1,
      totalExpenses: Number((res as any)._sum.montant || 0),
    }));

    console.log(
      `[TREASURY-PROJECTION] Yearly aggregation (12 queries) took ${Date.now() - startTime}ms`,
    );
    return monthlyData;
  }

  async updateEcheanceStatus(id: string, statut: string) {
    const data: any = { statut };
    if (statut === 'ENCAISSE' || statut === 'PAYE') {
      data.dateEncaissement = new Date();
    }

    return this.prisma.echeancePaiement.update({
      where: { id },
      data,
    });
  }

  async getPendingAlerts(centreId?: string) {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const last30days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [clientAlerts, supplierAlerts] = await Promise.all([
      // 1. Client Checks (24h before dateVersement)
      this.prisma.paiement.findMany({
        where: {
          mode: 'CHEQUE',
          statut: 'EN_ATTENTE',
          dateVersement: { lte: next24h, gte: last30days }, // Only look back 30 days
          facture: centreId ? { centreId } : {},
        },
        include: {
          facture: {
            include: { client: { select: { nom: true, prenom: true } } },
          },
        },
      }),
      // 2. Supplier Checks (48h before dateEcheance)
      this.prisma.echeancePaiement.findMany({
        where: {
          type: { in: ['CHEQUE', 'LCN'] },
          statut: 'EN_ATTENTE',
          dateEcheance: { lte: next48h, gte: last30days }, // Only look back 30 days
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
        include: {
          factureFournisseur: {
            include: { fournisseur: { select: { nom: true } } },
          },
          depense: { include: { fournisseur: { select: { nom: true } } } },
        },
      }),
    ]);

    return {
      client: clientAlerts.map((p) => ({
        id: p.id,
        client:
          `${p.facture.client?.nom || ''} ${p.facture.client?.prenom || ''}`.trim(),
        montant: p.montant,
        date: p.dateVersement,
        reference: p.reference,
        numeroFacture: p.facture.numero,
      })),
      supplier: supplierAlerts.map((e: any) => ({
        id: e.id,
        fournisseur:
          e.factureFournisseur?.fournisseur?.nom ||
          e.depense?.fournisseur?.nom ||
          'N/A',
        montant: e.montant,
        date: e.dateEcheance,
        reference: e.reference,
        source: e.factureFournisseur ? 'FACTURE' : 'DEPENSE',
      })),
    };
  }
}
