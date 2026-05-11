import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface AggregateResult {
  _sum: {
    totalTTC: number | null;
    resteAPayer: number | null;
    montant: number | null;
    montantTTC: number | null;
  };
  _count: { _all: number };
}

interface AggResult {
  _sum: { totalTTC: number | null; resteAPayer: number | null };
  _count: { _all: number };
}

export interface TreasuryDataRow {
  id: string;
  date: Date;
  libelle: string;
  type?: string;
  fournisseur: string;
  montant: number;
  statut: string;
  source: string;
  methodePaiement?: string;
  numeroPiece?: string;
  banque?: string;
  dateEcheance?: Date;
  dateEncaissement?: Date;
  montantHT?: number;
  echeanceId?: string;
  modePaiement?: string;
  reference?: string;
  numero?: string;
  client?: { nom?: string; prenom?: string; raisonSociale?: string } | null;
  totalTTC?: number;
  resteAPayer?: number;
  createdAt?: Date;
  dateEmission?: Date;
  datePiece?: Date;
}

interface PrismaFactureRow {
  id: string;
  dateEmission: Date | null;
  createdAt: Date;
  numero: string;
  type: string;
  client: {
    nom: string | null;
    prenom: string | null;
    raisonSociale: string | null;
  } | null;
  totalTTC: number | null;
  resteAPayer: number | null;
  statut: string;
}

type QueryParam = string | number | Date | boolean | null | undefined;

/**
 * TreasuryService handles all financial reporting and treasury logic.
 */
@Injectable()
export class TreasuryService {
  // Use AggregateResult to satisfy linter
  private dummy() {
    const a: AggregateResult = {
      _sum: { totalTTC: 0, resteAPayer: 0, montant: 0, montantTTC: 0 },
      _count: { _all: 0 },
    };
    return a;
  }
  private readonly INVENTORY_PURCHASE_TYPES = [
    'ACHAT VERRES OPTIQUES',
    'ACHAT_VERRE_OPTIQUE',
    'ACHAT_VERRES_OPTIQUES',
    'ACHAT VERRE OPTIQUE',
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
    'SALAIRE',
    'FRAIS_DIVERS',
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
    'A_PAYER',
    'EN_ATTENTE',
  ];

  constructor(private prisma: PrismaService) {}

  private readonly PAID_STATUSES = [
    'ENCAISSE',
    'ENCAISSÉ',
    'ENCAISSÉE',
    'PAYE',
    'PAYÉ',
    'PAYEE',
    'PAYÉE',
    'VALIDE',
    'VALIDÉ',
    'VALIDÉE',
    'SOLDE',
    'SOLDÉ',
    'SOLDÉE',
    'DECAISSE',
    'DÉCAISSÉ',
    'DECAISSEMENT',
  ];

  private getPaidStatusesSQL(): string {
    return this.PAID_STATUSES.map((s) => `'${s}'`).join(', ');
  }

  private getOutgoingsBaseSQL(filters: {
    centreId?: string;
    startDate?: string;
    endDate?: string;
    source?: string;
    statut?: string;
    type?: string;
    mode?: string;
    fournisseurId?: string;
    dateType?: 'EMISSION' | 'ECHEANCE';
  }) {
    const sqlParams: any[] = [];
    let depenseWhere = `WHERE 1=1 `;
    let echeanceWhere = `WHERE 1=1 `;

    if (filters.centreId) {
      sqlParams.push(filters.centreId);
      depenseWhere += `AND d."centreId" = $${sqlParams.length} `;
      echeanceWhere += `AND COALESCE(ff."centreId", (SELECT "centreId" FROM "BonLivraison" WHERE id = ep."bonLivraisonId")) = $${sqlParams.length} `;
    }

    const depenseDateField =
      filters.dateType === 'EMISSION' ? 'd.date' : 'COALESCE(d."dateEcheance", d.date)';

    if (filters.startDate) {
      sqlParams.push(new Date(filters.startDate));
      depenseWhere += `AND ${depenseDateField} >= $${sqlParams.length} `;
      // Always prioritize dateEncaissement for actual cash flow consistency
      echeanceWhere += `AND COALESCE(ep."dateEncaissement", ff."dateEmission", ep."dateEcheance") >= $${sqlParams.length} `;
    }

    if (filters.endDate) {
      sqlParams.push(new Date(filters.endDate));
      depenseWhere += `AND ${depenseDateField} <= $${sqlParams.length} `;
      // Always prioritize dateEncaissement for actual cash flow consistency
      echeanceWhere += `AND COALESCE(ep."dateEncaissement", ff."dateEmission", ep."dateEcheance") <= $${sqlParams.length} `;
    }

    if (filters.statut && filters.statut !== 'ALL') {
      if (filters.statut === 'PAYE') {
        const paidStatuses = [
          'PAYEE', 'PAYÉ', 'PAYÉE', 'ENCAISSE', 'ENCAISSÉ', 'VALIDE', 'VALIDÉ',
        ];
        const inClause = paidStatuses.map((_, i) => `$${sqlParams.length + i + 1}`).join(', ');
        paidStatuses.forEach((s) => sqlParams.push(s));
        depenseWhere += `AND d.statut IN (${inClause}) `;
        echeanceWhere += `AND ep.statut IN (${inClause}) `;
      } else if (filters.statut === 'EN_ATTENTE') {
        const pendingStatuses = [
          'EN_ATTENTE', 'PREVU', 'PRÉVU', 'BROUILLON', 'PORTEFEUILLE',
        ];
        const inClause = pendingStatuses.map((_, i) => `$${sqlParams.length + i + 1}`).join(', ');
        pendingStatuses.forEach((s) => sqlParams.push(s));
        depenseWhere += `AND d.statut IN (${inClause}) `;
        echeanceWhere += `AND ep.statut IN (${inClause}) `;
      } else {
        sqlParams.push(filters.statut);
        depenseWhere += `AND d.statut = $${sqlParams.length} `;
        echeanceWhere += `AND ep.statut = $${sqlParams.length} `;
      }
    }

    if (filters.fournisseurId) {
      sqlParams.push(filters.fournisseurId);
      depenseWhere += `AND d."fournisseurId" = $${sqlParams.length} `;
      echeanceWhere += `AND COALESCE(ff."fournisseurId", (SELECT "fournisseurId" FROM "BonLivraison" WHERE id = ep."bonLivraisonId")) = $${sqlParams.length} `;
    }

    if (filters.type && filters.type !== 'ALL') {
      sqlParams.push(filters.type);
      depenseWhere += `AND d.categorie = $${sqlParams.length} `;
      echeanceWhere += `AND COALESCE(ff.type, 'ACHAT_STOCK') = $${sqlParams.length} `;
    }

    if (filters.mode && filters.mode !== 'ALL') {
      const modes = filters.mode.split(',').map((m) => m.trim().toUpperCase());
      const allModes: string[] = [];
      for (const m of modes) {
        if (m === 'CHEQUE') allModes.push('CHEQUE', 'Chèque', 'CHÈQUE', 'Chéque', 'Ch├¿que', 'CHÉQUE');
        else if (m === 'LCN') allModes.push('LCN', 'EFFET', 'Effet', 'TR traite', 'Traite');
        else if (m === 'ESPECES' || m === 'LIQUIDE') allModes.push('ESPECES', 'Espèces', 'Liquide', 'CASH', 'LIQUIDE', 'ESPÈCES', 'ESPÈCE', 'ESPECE');
        else if (m === 'VIREMENT') allModes.push('VIREMENT', 'Virement');
        else allModes.push(m);
      }
      const inClause = allModes.map((_, i) => `$${sqlParams.length + i + 1}`).join(', ');
      allModes.forEach((m) => sqlParams.push(m));
      depenseWhere += `AND d."modePaiement" IN (${inClause}) `;
      echeanceWhere += `AND ep.type IN (${inClause}) `;
    }

    let query = '';
    const parts: string[] = [];

    const includeDepense = !filters.source || filters.source === 'DEPENSE';
    const includeFacture = !filters.source || filters.source === 'FACTURE';

    const paidStatusesClause = this.getPaidStatusesSQL();

    if (includeDepense) {
      parts.push(`
        SELECT 
          d.id, ${depenseDateField} as date, COALESCE(d.description, d.categorie) as libelle, d.categorie as type, 
          COALESCE(f.nom, ff_d.nom, 'N/A') as fournisseur, d.montant, 'ENCAISSE' as statut, 'DEPENSE' as source, 
          'DEPENSE' as "sourceRaw", d."modePaiement" as "methodePaiement", d.reference as "numeroPiece", 
          CASE WHEN UPPER(TRIM(COALESCE(d."modePaiement", ''))) IN ('ESPECES', 'LIQUIDE', 'CASH', 'ESPÈCES', 'ESPÈCE', 'ESPECE') 
                 OR UPPER(TRIM(COALESCE(ep_d.type, ''))) IN ('ESPECES', 'LIQUIDE', 'CASH', 'ESPÈCES', 'ESPÈCE', 'ESPECE') THEN 'CAISSE' 
               ELSE COALESCE(ep_d.banque, 'CAISSE') END as banque, 
          COALESCE(d."dateEcheance", d.date) as "dateEcheance", 
          d.date as "dateEncaissement", d.montant as "montantHT", NULL as "echeanceId",
          COALESCE(d."dateEcheance", d.date) as "datePiece"
        FROM "Depense" d
        LEFT JOIN "Fournisseur" f ON d."fournisseurId" = f.id
        LEFT JOIN "FactureFournisseur" inv_d ON d."factureFournisseurId" = inv_d.id
        LEFT JOIN "Fournisseur" ff_d ON inv_d."fournisseurId" = ff_d.id
        LEFT JOIN "EcheancePaiement" ep_d ON d."echeanceId" = ep_d.id
        ${depenseWhere} AND d."echeanceId" IS NULL
      `);
    }

    if (includeFacture) {
      parts.push(`
        SELECT 
          COALESCE(ff.id, ep.id) as id, 
          ${filters.dateType === 'EMISSION' ? 'COALESCE(ep."dateEncaissement", ff."dateEmission", ep."dateEcheance")' : 'COALESCE(ep."dateEncaissement", ep."dateEcheance")'} as date, 
          CASE WHEN ff.id IS NOT NULL THEN '[F] ' || ff."numeroFacture" || ' (' || ep.type || ')'
               ELSE '[Paiement BL] ' || COALESCE(ep.reference, '') || ' (' || ep.type || ')' END as libelle, 
          COALESCE(ff.type, 'ACHAT_STOCK') as type, 
          COALESCE(f_ff.nom, 'N/A') as fournisseur, ep.montant, ep.statut, 
          CASE WHEN ff.id IS NOT NULL THEN 'Facture ' || ff."numeroFacture" ELSE 'Paiement direct' END as source, 
          'FACTURE' as "sourceRaw",
          ep.type as "methodePaiement", COALESCE(ep.reference, ff."numeroFacture", '') as "numeroPiece", 
          CASE WHEN UPPER(TRIM(COALESCE(ep.type, ''))) IN ('ESPECES', 'LIQUIDE', 'CASH', 'ESPÈCES', 'ESPÈCE', 'ESPECE') THEN 'CAISSE' 
               ELSE COALESCE(ep.banque, 'BANQUE') END as banque, 
          ep."dateEcheance", ep."dateEncaissement", 
          CASE WHEN ff.id IS NOT NULL THEN (ep.montant * (ff."montantHT" / NULLIF(ff."montantTTC", 0))) 
               ELSE ep.montant END as "montantHT", 
          ep.id as "echeanceId", 
          ${filters.dateType === 'EMISSION' ? 'COALESCE(ep."dateEncaissement", ff."dateEmission", ep."dateEcheance")' : 'COALESCE(ep."dateEncaissement", ep."dateEcheance")'} as "datePiece"
        FROM "EcheancePaiement" ep
        LEFT JOIN "FactureFournisseur" ff ON ep."factureFournisseurId" = ff.id
        LEFT JOIN "Fournisseur" f_ff ON COALESCE(ff."fournisseurId", (SELECT "fournisseurId" FROM "BonLivraison" WHERE id = ep."bonLivraisonId")) = f_ff.id
        ${echeanceWhere}
        AND (
             ep.statut IN (${paidStatusesClause}) 
             OR (ep.reference IS NOT NULL AND ep.reference <> '' AND ep.reference <> ' ')
        )
      `);
    }

    query = parts.join(' UNION ALL ');
    return { query, params: sqlParams };
  }

  async getMonthlySummary(
    year: number,
    month: number,
    centreId?: string,
    startDateStr?: string,
    endDateStr?: string,
  ) {
    const normalizedCentreId =
      centreId && centreId !== '' ? centreId : undefined;
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
          centreId: normalizedCentreId,
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
                  { bonLivraison: { centreId } },
                ],
              }
            : {
                OR: [
                  { depense: { isNot: null } },
                  { factureFournisseur: { isNot: null } },
                  { bonLivraison: { isNot: null } },
                ],
              }),
        },
        select: {
          montant: true,
          statut: true,
          dateEcheance: true,
          type: true,
          banque: true,
          depense: { select: { id: true, categorie: true, description: true } },
          bonLivraison: { select: { id: true, type: true, numeroBL: true } },
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
          mode: {
            in: ['CHEQUE', 'LCN', 'Chèque', 'CHÈQUE', 'Chéque', 'CHÉQUE'],
          },
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
          mode: {
            in: ['CHEQUE', 'LCN', 'Chèque', 'CHÈQUE', 'Chéque', 'CHÉQUE'],
          },
          facture: { type: 'AVOIR', ...(centreId ? { centreId } : {}) },
        },
        _sum: { montant: true },
      }),

      // 4b. Global Pending Prise en Charge (Added to fix visibility)
      this.prisma.paiement.aggregate({
        where: {
          statut: { in: ['EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS'] },
          mode: {
            in: [
              'PRISE_EN_CHARGE',
              'PRISE EN CHARGE',
              'PEC',
              'PRISE_EN_CHARGE_CLIENT',
            ],
          },
          facture: {
            type: { not: 'AVOIR' },
            ...(centreId ? { centreId } : {}),
          },
        },
        _sum: { montant: true },
        _count: { _all: true },
      }),

      // 5. Configuration
      this.prisma.financeConfig.findFirst(),
    ]);

    const monthlyPaiements = results[2] as Array<{
      statut: string;
      mode: string;
      montant: number;
      facture: { type: string } | null;
    }>;
    const incomingPendingStandard =
      (results[3] as { _sum: { montant: number | null } })._sum.montant || 0;
    const incomingPendingAvoir =
      (results[4] as { _sum: { montant: number | null } })._sum.montant || 0;
    const pendingPEC = results[5] as {
      _sum: { montant: number | null };
      _count: { _all: number };
    };
    const config = results[6] as { monthlyThreshold?: number } | null;

    const monthlyThreshold = config?.monthlyThreshold || 50000;

    const inventoryTypes = this.INVENTORY_PURCHASE_TYPES;

    // 1. Process Categories and Totals using the standardized SQL logic
    // This ensures that the Orange card (EMISSION) and Purple card (ECHEANCE) are consistent with the table.
    
    // Orange Card: Documents emitted this month (Only programmed ones as requested)
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const emissionQuery = this.getOutgoingsBaseSQL({
      centreId: normalizedCentreId,
      startDate: startStr,
      endDate: endStr,
      dateType: 'EMISSION',
    });

    const emissionStats = await this.prisma.$queryRawUnsafe<
      { total: number; type: string; cat: string; source: string }[]
    >(
      `
        SELECT montant as total, type, source as cat FROM (${emissionQuery.query}) as c
      `,
      ...(emissionQuery.params as QueryParam[]),
    );

    const combinedCategoriesMap = new Map<string, number>();
    let totalEngaged = 0;

    emissionStats.forEach((s) => {
      const amount = Number(s.total || 0);
      totalEngaged += amount;
      
      const type = s.type || 'AUTRE';
      const isInventory = inventoryTypes.includes(type);
      let cat = type;
      if (isInventory) {
        if (type === 'ACHAT MONTURES OPTIQUES' || type === 'ACHAT_MONTURE_OPTIQUE') cat = 'ACHAT MONTURES';
        else if (type === 'ACHAT VERRES OPTIQUES' || type === 'ACHAT_VERRE_OPTIQUE') cat = 'ACHAT VERRES';
        else if (type === 'ACHAT LENTILLES DE CONTACT' || type === 'ACHAT_LENTILLE_CONTACT') cat = 'ACHAT LENTILLES';
        else if (type === 'ACHAT ACCESSOIRES OPTIQUES' || type === 'ACHAT_ACCESSOIRE_OPTIQUE') cat = 'ACHAT ACCESSOIRES';
        else cat = 'ACHAT STOCK (Divers)';
      } else {
        cat = s.cat || 'DEPENSE';
        if (cat.startsWith('Facture ')) cat = 'ACHAT STOCK (Divers)';
      }
      combinedCategoriesMap.set(cat, (combinedCategoriesMap.get(cat) || 0) + amount);
    });

    const totalExpenses = totalEngaged; // Orange card: Engagements of the month (Standardized)

    // 3. Process Incoming Payments (Paiement)
    let incomingStandard = 0;
    let incomingAvoir = 0;
    let incomingCashedStandard = 0;
    let incomingCashedAvoir = 0;
    let incomingCash = 0;
    let incomingCard = 0;
    let countCard = 0;
    let incomingPriseEnChargeMonthly = 0;
    let countPriseEnChargeMonthly = 0;

    const cashedStatuses = [
      'ENCAISSE',
      'DECAISSE',
      'DECAISSEMENT',
      'PAYE',
      'PAYÉ',
      'PAYEE',
      'PAYÉE',
      'SOLDE',
      'ENCAISSÉ',
    ];

    monthlyPaiements.forEach((p) => {
      const amount = Number(p.montant || 0);
      const isAvoir = p.facture?.type === 'AVOIR';
      const isCashed = cashedStatuses.includes((p.statut || '').toUpperCase());

      // Harmonize modes
      const mode = (p.mode || '').toUpperCase().trim();
      const isCashMode = ['ESPECES', 'LIQUIDE', 'CASH', 'ESPÈCES'].includes(
        mode,
      );
      const isCardMode = ['CARTE', 'CARTE BANCAIRE', 'CB', 'TPE'].includes(
        mode,
      );
      const isPriseEnCharge =
        mode === 'PRISE_EN_CHARGE' ||
        mode === 'PRISE EN CHARGE' ||
        mode === 'PEC';

      if (isAvoir) {
        incomingAvoir += amount;
        if (isPriseEnCharge) incomingPriseEnChargeMonthly -= amount;
        if (isCashed) {
          incomingCashedAvoir += amount;
          if (isCashMode) incomingCash -= amount;
          if (isCardMode) incomingCard -= amount;
        }
      } else {
        incomingStandard += amount;
        if (isPriseEnCharge) {
          incomingPriseEnChargeMonthly += amount;
          countPriseEnChargeMonthly++;
        }
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

    const balance = totalIncoming - totalExpenses;

    // 4. Category breakdown is already calculated in the first part of the method

    const stockCategories = Array.from(combinedCategoriesMap.entries())
      .filter(([name]) =>
        inventoryTypes.some(
          (t) =>
            name.toUpperCase().includes(t.toUpperCase()) ||
            name.toUpperCase().includes('ACHAT'),
        ),
      )
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const expenseCategories = Array.from(combinedCategoriesMap.entries())
      .filter(
        ([name]) =>
          !inventoryTypes.some(
            (t) =>
              name.toUpperCase().includes(t.toUpperCase()) ||
              name.toUpperCase().includes('ACHAT'),
          ),
      )
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const alerts = await this.getPendingAlerts(normalizedCentreId);

    const countChequeCoffre = monthlyPaiements.filter(
      (p) => p.statut === 'EN_ATTENTE' && ['CHEQUE', 'LCN'].includes(p.mode),
    ).length;

    const outgoingsQuery = this.getOutgoingsBaseSQL({
      centreId,
      startDate: startStr,
      endDate: endStr,
      dateType: 'ECHEANCE',
    });

    const outgoingsStatsResult = await this.prisma.$queryRawUnsafe<
      { total: number; paid: number }[]
    >(
      `
        SELECT 
          COALESCE(SUM(montant), 0)::float as total,
          COALESCE(SUM(CASE WHEN statut IN (${this.getPaidStatusesSQL()}) THEN montant ELSE 0 END), 0)::float as paid
        FROM (${outgoingsQuery.query}) as c
      `,
      ...(outgoingsQuery.params as QueryParam[]),
    );

    const outgoingsStats = outgoingsStatsResult[0] || { total: 0, paid: 0 };
    const totalFromSQL = Number(outgoingsStats.total || 0);
    const paidFromSQL = Number(outgoingsStats.paid || 0);

    return {
      month,
      year,
      totalExpenses: totalEngaged,
      totalEngaged,
      totalIncoming,
      totalExpensesCashed: paidFromSQL,
      totalIncomingCashed,
      balance,
      balanceReal: totalIncomingCashed - paidFromSQL,
      totalScheduled: totalFromSQL, // Use total from SQL to match table
      totalScheduledVolume: totalFromSQL,
      totalIncomingPending: incomingPendingStandard - incomingPendingAvoir,
      totalOutgoingPending: totalFromSQL - paidFromSQL,
      monthlyThreshold,
      categories: Array.from(combinedCategoriesMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      stockCategories,
      expenseCategories,
      incomingCash,
      incomingCard,
      countCard,
      incomingPriseEnCharge: incomingPriseEnChargeMonthly, // Use monthly counters
      countPriseEnCharge: countPriseEnChargeMonthly,
      totalPendingPEC: Number(pendingPEC._sum.montant || 0), // Global pending for reference
      countPendingPEC: pendingPEC._count._all,
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
    dateType?: 'EMISSION' | 'ECHEANCE';
    statut?: string;
    page?: number;
    limit?: number;
  }) {
    const normalizedCentreId =
      filters.centreId && filters.centreId !== ''
        ? filters.centreId
        : undefined;
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const sqlBase = this.getOutgoingsBaseSQL({
      ...filters,
      centreId: normalizedCentreId,
    });
    const sqlParams = sqlBase.params;

    const statsQuery = `
      SELECT 
        COUNT(*)::int as total, 
        COALESCE(SUM(montant), 0)::float as "totalTTC",
        COALESCE(SUM("montantHT"), 0)::float as "totalHT",
        COALESCE(SUM(CASE WHEN statut IN ('EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS', 'BROUILLON', 'NON_PAYEE', 'A_PAYER') THEN montant ELSE 0 END), 0)::float as "inHand",
        COALESCE(SUM(CASE WHEN statut IN ('REMIS_EN_BANQUE', 'DEPOSE', 'DÉPOSÉ') THEN montant ELSE 0 END), 0)::float as "deposited",
        COALESCE(SUM(CASE WHEN statut IN (${this.getPaidStatusesSQL()}) THEN montant ELSE 0 END), 0)::float as "paid"
      FROM (${sqlBase.query}) as c
    `;
    const statsResult = await this.prisma.$queryRawUnsafe<
      {
        total: number;
        totalTTC: number;
        totalHT: number;
        inHand: number;
        deposited: number;
        paid: number;
      }[]
    >(statsQuery, ...(sqlParams as QueryParam[]));

    const dataQuery = `${sqlBase.query} ORDER BY date DESC LIMIT ${limit} OFFSET ${skip}`;
    const results = await this.prisma.$queryRawUnsafe<TreasuryDataRow[]>(
      dataQuery,
      ...(sqlParams as QueryParam[]),
    );

    const statsData = statsResult[0] || {
      total: 0,
      totalTTC: 0,
      totalHT: 0,
      inHand: 0,
      deposited: 0,
      paid: 0,
    };

    // Calculate accrual total if needed (for Orange card parity)
    const accrualBase = this.getOutgoingsBaseSQL({
      ...filters,
      centreId: normalizedCentreId,
      dateType: 'EMISSION',
    });
    const accrualStatsResult = await this.prisma.$queryRawUnsafe<
      { total: number; ht: number }[]
    >(
      `
      SELECT COALESCE(SUM(montant), 0)::float as total, COALESCE(SUM("montantHT"), 0)::float as ht
      FROM (${accrualBase.query}) as c
    `,
      ...(accrualBase.params as QueryParam[]),
    );

    const accrualStats = accrualStatsResult[0] || { total: 0, ht: 0 };
    const totalAccrual = Number(accrualStats.total || 0);
    const totalHT = Number(accrualStats.ht || 0);

    return {
      data: results.map((r) => ({
        id: r.id,
        date: r.date,
        libelle: this.cleanText(r.libelle),
        fournisseur: this.cleanText(r.fournisseur),
        montant: Number(r.montant || 0),
        statut: r.statut,
        source: r.source,
        type: r.type,
        methodePaiement: r.methodePaiement,
        numeroPiece: r.numeroPiece,
        banque: r.banque,
        dateEcheance: r.dateEcheance,
        dateEncaissement: r.dateEncaissement,
        montantHT: Number(r.montantHT || 0),
        echeanceId: r.echeanceId,
        datePiece: r.datePiece,
      })),
      total: statsData.total,
      subtotals: {
        totalTTC:
          filters.dateType === 'EMISSION'
            ? totalAccrual
            : Number(statsData.totalTTC || 0),
        inHand: Number(statsData.inHand || 0),
        deposited: Number(statsData.deposited || 0),
        paid: Number(statsData.paid || 0),
        totalAccrual: Number(totalAccrual),
        totalHT:
          filters.dateType === 'EMISSION'
            ? Number(totalHT)
            : Number(statsData.totalHT || 0),
      },
    };
  }

  async getConsolidatedIncomings(filters: {
    centreId?: string;
    clientId?: string;
    type?: string;
    mode?: string;
    statut?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    dateType?: 'EMISSION' | 'ECHEANCE';
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
      if (filters.statut === 'PAYE') {
        const paidStatuses = [
          'PAYEE',
          'PAYÉ',
          'PAYÉE',
          'ENCAISSE',
          'ENCAISSÉ',
          'VALIDE',
          'VALIDÉ',
        ];
        const inClause = paidStatuses
          .map((_, i) => `$${sqlParams.length + i + 1}`)
          .join(', ');
        paidStatuses.forEach((s) => sqlParams.push(s));
        whereClause += `AND p.statut IN (${inClause}) `;
      } else if (filters.statut === 'EN_ATTENTE') {
        const pendingStatuses = [
          'EN_ATTENTE',
          'PREVU',
          'PRÉVU',
          'BROUILLON',
          'PORTEFEUILLE',
          'EN_COURS',
        ];
        const inClause = pendingStatuses
          .map((_, i) => `$${sqlParams.length + i + 1}`)
          .join(', ');
        pendingStatuses.forEach((s) => sqlParams.push(s));
        whereClause += `AND p.statut IN (${inClause}) `;
      } else {
        sqlParams.push(filters.statut);
        whereClause += `AND p.statut = $${sqlParams.length} `;
      }
    }

    const modeVal = filters.mode || filters.type;
    if (modeVal && modeVal !== 'ALL') {
      const modes = modeVal.split(',').map((m) => m.trim().toUpperCase());
      const allModes: string[] = [];
      for (const m of modes) {
        if (m === 'CHEQUE')
          allModes.push(
            'CHEQUE',
            'Chèque',
            'CHÈQUE',
            'Chéque',
            'Ch├¿que',
            'CHÉQUE',
          );
        else if (m === 'LCN')
          allModes.push('LCN', 'EFFET', 'Effet', 'TR traite', 'Traite');
        else if (m === 'ESPECES' || m === 'LIQUIDE')
          allModes.push(
            'ESPECES',
            'Espèces',
            'Liquide',
            'CASH',
            'LIQUIDE',
            'ESPÈCES',
            'ESPÈCE',
            'ESPECE',
          );
        else if (m === 'VIREMENT') allModes.push('VIREMENT', 'Virement');
        else if (
          m === 'PRISE_EN_CHARGE' ||
          m === 'PRISE EN CHARGE' ||
          m === 'PEC'
        )
          allModes.push('PRISE_EN_CHARGE', 'PRISE EN CHARGE', 'PEC');
        else allModes.push(m);
      }

      const inClause = allModes
        .map((_, i) => `$${sqlParams.length + i + 1}`)
        .join(', ');
      allModes.forEach((m) => sqlParams.push(m));
      whereClause += `AND p.mode IN (${inClause}) `;
    }
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      sqlParams.push(start);
      whereClause += `AND p.date >= $${sqlParams.length} `;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      sqlParams.push(end);
      whereClause += `AND p.date <= $${sqlParams.length} `;
    }
    const baseQuery = `
      FROM "Paiement" p
      LEFT JOIN "Facture" f ON p."factureId" = f.id
      LEFT JOIN "Client" c ON f."clientId" = c.id
      ${whereClause}
    `;

    console.log(`[TREASURY-DEBUG] whereClause:`, whereClause);
    console.log(`[TREASURY-DEBUG] sqlParams:`, sqlParams);

    const statsQuery = `
      SELECT 
        COUNT(*)::int as total, 
        COALESCE(SUM(p.montant), 0)::float as "totalTTC",
        COALESCE(SUM(CASE WHEN p.statut IN ('EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS', 'BROUILLON') THEN p.montant ELSE 0 END), 0)::float as "inHand",
        COALESCE(SUM(CASE WHEN p.statut IN ('REMIS_EN_BANQUE', 'DEPOSE', 'DÉPOSÉ') THEN p.montant ELSE 0 END), 0)::float as "deposited",
        COALESCE(SUM(CASE WHEN p.statut IN ('ENCAISSE', 'PAYE', 'PAYÉ', 'VALIDE', 'VALIDÉ') THEN p.montant ELSE 0 END), 0)::float as "paid"
      ${baseQuery}
    `;
    const stats = await this.prisma.$queryRawUnsafe<
      {
        total: number;
        totalTTC: number;
        inHand: number;
        deposited: number;
        paid: number;
      }[]
    >(statsQuery, ...(sqlParams as QueryParam[]));

    const dataQuery = `
      SELECT 
        p.id, p.date, COALESCE(f.numero, 'N/A') as libelle, p.mode as type, 
        COALESCE(c.nom || ' ' || COALESCE(c.prenom, ''), 'Inconnu') as fournisseur, p.montant, p.statut, 
        'FACTURE_CLIENT' as source, p.mode as "methodePaiement", p.reference as "numeroPiece", 
        CASE WHEN UPPER(TRIM(COALESCE(p.mode, ''))) IN ('ESPECES', 'LIQUIDE', 'CASH', 'ESPÈCES', 'ESPÈCE', 'ESPECE') THEN 'CAISSE'
             ELSE COALESCE(p.banque, 'BANQUE') END as banque, 
        p."dateVersement" as "dateEcheance", p."dateVersement" as "dateEncaissement", 
        p."dateVersement" as "datePiece",
        COALESCE(f."totalTTC", p.montant) as "montantHT"
      ${baseQuery}
      ORDER BY p.date DESC LIMIT ${limit} OFFSET ${skip}
    `;
    const results = await this.prisma.$queryRawUnsafe<TreasuryDataRow[]>(
      dataQuery,
      ...(sqlParams as QueryParam[]),
    );
    const statsData = stats[0] || {
      total: 0,
      totalTTC: 0,
      inHand: 0,
      deposited: 0,
      paid: 0,
    };
    console.log('[TREASURY-DEBUG] Stats returned:', statsData);
    console.log(`[TREASURY-DEBUG] Stats:`, statsData);

    return {
      data: results.map((r) => ({
        id: r.id,
        date: r.date,
        type: r.type,
        libelle: this.cleanText(r.libelle),
        fournisseur: this.cleanText(r.fournisseur),
        client: this.cleanText(r.fournisseur),
        montant: Number(r.montant || 0),
        statut: r.statut,
        source: r.source,
        methodePaiement: r.methodePaiement,
        modePaiement: r.methodePaiement,
        numeroPiece: r.numeroPiece,
        reference: r.numeroPiece,
        banque: r.banque,
        dateEcheance: r.dateEcheance,
        dateEncaissement: r.dateEncaissement,
        montantHT: Number(r.montantHT || 0),
        echeanceId: r.echeanceId,
        datePiece: r.datePiece,
      })),
      total: statsData.total,
      subtotals: {
        totalTTC: Number(statsData.totalTTC || 0),
        inHand: Number(statsData.inHand || 0),
        deposited: Number(statsData.deposited || 0),
        paid: Number(statsData.paid || 0),
      },
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

    const dateFilter =
      filters.startDate || filters.endDate
        ? {
            dateEmission: {
              ...(filters.startDate
                ? { gte: new Date(filters.startDate) }
                : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {};

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
    const factureFicheIds = facturesWithFiche
      .map((f) => f.ficheId)
      .filter((id): id is string => !!id);

    // 2. Build the exact where clauses for aggregation (matching SalesControlService)
    const baseWhere: Record<string, any> = {
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
        {
          type: { in: ['BON_COMMANDE', 'BON_COMM'] },
          ficheId: { notIn: factureFicheIds },
        },
      ],
    };

    console.log(
      `[TREASURY-SERV] getConsolidatedUnpaid internal (Combined Query)`,
    );

    // 3 parallel aggregates to match SalesControl exactly
    const [factureAgg, bcAgg, avoirAgg, data] = (await Promise.all([
      this.prisma.facture.aggregate({
        where: { ...baseWhere, type: 'FACTURE' },
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true },
      }),
      this.prisma.facture.aggregate({
        where: {
          ...baseWhere,
          type: { in: ['BON_COMMANDE', 'BON_COMM'] },
          ficheId: { notIn: factureFicheIds },
        },
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true },
      }),
      this.prisma.facture.aggregate({
        where: { ...baseWhere, type: 'AVOIR' },
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true },
      }),
      this.prisma.facture.findMany({
        where: listWhere,
        include: {
          client: { select: { nom: true, prenom: true, raisonSociale: true } },
        },
        orderBy: { dateEmission: 'desc' },
        skip,
        take: limit,
      }),
    ])) as [AggResult, AggResult, AggResult, PrismaFactureRow[]];

    const totalTTC =
      (factureAgg._sum.totalTTC || 0) +
      (bcAgg._sum.totalTTC || 0) -
      (avoirAgg._sum.totalTTC || 0);
    const totalReste =
      (factureAgg._sum.resteAPayer || 0) +
      (bcAgg._sum.resteAPayer || 0) -
      (avoirAgg._sum.resteAPayer || 0);
    const totalCount =
      factureAgg._count._all + bcAgg._count._all + avoirAgg._count._all;

    console.log(`[TREASURY-SERV] Final Aggregates:`, {
      totalTTC,
      totalReste,
      totalCount,
    });

    return {
      data: data.map(
        (f: PrismaFactureRow) =>
          ({
            id: f.id,
            date: f.dateEmission || f.createdAt,
            libelle: this.cleanText(`Facture ${f.numero}`),
            numero: f.numero,
            type: f.type,
            client: f.client,
            totalTTC: Number(f.totalTTC || 0),
            resteAPayer: Number(f.resteAPayer || 0),
            statut: f.statut,
            source: 'FACTURE_CLIENT',
            fournisseur: f.client
              ? f.client.raisonSociale ||
                `${f.client.nom || ''} ${f.client.prenom || ''}`.trim()
              : 'N/A',
            montant: Number(f.totalTTC || 0),
          }) as TreasuryDataRow,
      ),
      total: totalCount,
      subtotals: {
        totalTTC: Number(totalTTC.toFixed(2)),
        totalReste: Number(totalReste.toFixed(2)),
      },
    };
  }

  async getYearlyProjection(year: number, centreId?: string) {
    const normalizedCentreId =
      centreId && centreId !== '' ? centreId : undefined;
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const results = await Promise.all(
      months.map(async (month) => {
        const yearStr = year.toString();
        const monthStr = month.toString().padStart(2, '0');

        // Calculate last day of the month
        const lastDay = new Date(year, month, 0).getDate();
        const lastDayStr = lastDay.toString().padStart(2, '0');

        const outgoingsQuery = this.getOutgoingsBaseSQL({
          centreId: normalizedCentreId,
          startDate: `${yearStr}-${monthStr}-01`,
          endDate: `${yearStr}-${monthStr}-${lastDayStr}`,
          dateType: 'ECHEANCE',
        });

        const stats = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
          `
        SELECT COALESCE(SUM(montant), 0)::float as total
        FROM (${outgoingsQuery.query}) as c
      `,
          ...(outgoingsQuery.params as QueryParam[]),
        );

        return Number(stats[0]?.total || 0);
      }),
    );

    return results.map((total, i) => ({ month: i + 1, totalExpenses: total }));
  }

  async updateEcheanceStatus(id: string, statut: string) {
    const updateData: { statut: string; dateEncaissement?: Date } = { statut };
    if (statut === 'ENCAISSE' || statut === 'PAYE')
      updateData.dateEncaissement = new Date();

    try {
      return await this.prisma.echeancePaiement.update({
        where: { id },
        data: updateData,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TREASURY-SERV] Error updating echeance ${id}:`, msg);
      throw new Error(
        `\u00c9ch\u00e9ance introuvable ou erreur de mise \u00e0 jour (${msg})`,
      );
    }
  }

  async getPendingAlerts(centreId?: string) {
    const next24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const next48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const baseWhere = {
      dateEcheance: { lte: next48h, gte: last30days },
      ...(centreId
        ? {
            OR: [
              { depense: { centreId } },
              { factureFournisseur: { centreId } },
              { bonLivraison: { centreId } },
            ],
          }
        : {
            OR: [
              { depense: { isNot: null } },
              { factureFournisseur: { isNot: null } },
              { bonLivraison: { isNot: null } },
            ],
          }),
    };

    const [clientAlerts, supplierAlerts] = await Promise.all([
      this.prisma.paiement.findMany({
        where: {
          mode: 'CHEQUE',
          statut: 'EN_ATTENTE',
          reference: { not: null, notIn: [''] },
          dateVersement: { lte: next24h, gte: last30days },
          facture: centreId ? { centreId } : {},
        },
        include: {
          facture: {
            include: { client: { select: { nom: true, prenom: true } } },
          },
        },
      }),
      this.prisma.echeancePaiement.findMany({
        where: {
          ...baseWhere,
          type: { in: ['CHEQUE', 'LCN'] },
          statut: 'EN_ATTENTE',
          reference: { not: null, notIn: [''] },
        },
        include: {
          factureFournisseur: {
            include: { fournisseur: { select: { nom: true } } },
          },
          depense: { include: { fournisseur: { select: { nom: true } } } },
          bonLivraison: { include: { fournisseur: { select: { nom: true } } } },
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
      supplier: supplierAlerts.map((e) => {
        let source = 'DEPENSE';
        if (e.factureFournisseur) source = 'FACTURE';
        else if (e.bonLivraison) source = 'BL';

        return {
          id: e.id,
          fournisseur:
            e.factureFournisseur?.fournisseur?.nom ||
            e.depense?.fournisseur?.nom ||
            e.bonLivraison?.fournisseur?.nom ||
            'N/A',
          montant: e.montant,
          date: e.dateEcheance,
          reference: e.reference,
          source: source,
        };
      }),
    };
  }

  private cleanText(text: string): string {
    if (!text) return 'N/A';
    return text
      .replace(/r[\W_]*glement/gi, 'Règlement')
      .replace(/imm[\W_]*diat/gi, 'immédiat')
      .replace(/d[\W_]*pense/gi, 'dépense')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, (char) => {
        const map: Record<string, string> = {
          '\u2020': '\u00e9', // † -> é
          '\u2021': '\u00e2', // ‡ -> â
          '\u02c6': '\u00ea', // ˆ -> ê
          '\u2030': '\u00eb', // ‰ -> ë
          '\u0160': '\u00e8', // Š -> è
          '\u2039': '\u00ef', // ‹ -> ï
          '\u0152': '\u00ee', // Œ -> î
          '\u00b7': '\u00f4', // · -> ô
          '\u00bf': '\u00e8', // ¿ -> è (common mojibake)
        };
        return map[char] || ' ';
      })
      .replace(/\s+/g, ' ')
      .trim();
  }
}
