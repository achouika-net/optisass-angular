import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

@Injectable()
export class TreasuryService {
  private readonly INVENTORY_PURCHASE_TYPES = [
    'ACHAT VERRES OPTIQUES',
    'ACHAT_VERRE_OPTIQUE',
    'ACHAT_VERRES_OPTIQUES',
    'ACHAT VERRE OPTIQUE',
    'ACHAT MONTURES OPTIQUES',
    'ACHAT_MONTURE_OPTIQUE',
    'ACHAT_MONTURES_OPTIQUES',
    'ACHAT MONTURE OPTIQUE',
    'ACHAT LENTILLLES DE CONTACT',
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

  constructor(private prisma: PrismaService) {}

  private getPaidStatusesSQL(): string {
    return this.PAID_STATUSES.map((s) => `'${s}'`).join(', ');
  }

  private getOutgoingsBaseSQL(filters: any) {
    const sqlParams: any[] = [];
    let depenseWhere = `WHERE 1=1 `;
    let echeanceWhere = `WHERE 1=1 `;

    if (filters.centreId) {
      sqlParams.push(filters.centreId);
      depenseWhere += `AND d."centreId" = $${sqlParams.length} `;
      echeanceWhere += `AND COALESCE(ff."centreId", (SELECT "centreId" FROM "BonLivraison" WHERE id = ep."bonLivraisonId" LIMIT 1), (SELECT "centreId" FROM "Depense" WHERE "echeanceId" = ep.id LIMIT 1)) = $${sqlParams.length} `;
    }

    const depenseDateField =
      filters.dateType === 'EMISSION'
        ? 'd.date'
        : 'COALESCE(ep_d."dateEcheance", d."dateEcheance", d.date)';
    const echeanceDateField =
      filters.dateType === 'EMISSION'
        ? 'COALESCE(ff."dateEmission", ep."dateEcheance")'
        : 'COALESCE(ep."dateEncaissement", ep."dateEcheance", ff."dateEmission")';

    if (filters.startDate && filters.endDate) {
      sqlParams.push(new Date(filters.startDate), new Date(filters.endDate));
      depenseWhere += `AND ${depenseDateField} >= $${sqlParams.length - 1} AND ${depenseDateField} <= $${sqlParams.length} `;
      echeanceWhere += `AND ${echeanceDateField} >= $${sqlParams.length - 1} AND ${echeanceDateField} <= $${sqlParams.length} `;
    }

    if (filters.statut && filters.statut !== 'ALL') {
      if (filters.statut === 'PAYE') {
        const clause = `IN (${this.getPaidStatusesSQL()})`;
        depenseWhere += `AND d.statut ${clause} `;
        echeanceWhere += `AND ep.statut ${clause} `;
      } else {
        sqlParams.push(filters.statut);
        const sIdx = sqlParams.length;
        depenseWhere += `AND d.statut = $${sIdx} `;
        echeanceWhere += `AND ep.statut = $${sIdx} `;
      }
    }

    const modeVal = filters.mode || filters.modePaiement;
    if (modeVal && modeVal !== 'ALL') {
      const allModes = this.getNormalizedModes(modeVal);
      const inClause = allModes
        .map((_, i) => `$${sqlParams.length + i + 1}`)
        .join(', ');
      allModes.forEach((m) => sqlParams.push(m));
      depenseWhere += `AND d."modePaiement" IN (${inClause}) `;
      echeanceWhere += `AND ep.type IN (${inClause}) `;
    }

    const includeDepense = !filters.source || filters.source === 'DEPENSE';
    const includeFacture = !filters.source || filters.source === 'FACTURE';

    const parts: string[] = [];
    if (includeDepense) {
      parts.push(`
        SELECT 
          d.id, ${depenseDateField} as date, COALESCE(d.description, d.categorie) as libelle, d.categorie as type, 
          COALESCE(f.nom, ff_d.nom, 'N/A') as fournisseur, d.montant, COALESCE(ep_d.statut, 'ENCAISSE') as statut, 'DEPENSE' as source, 
          d."modePaiement" as "methodePaiement", d.reference as "numeroPiece", 
          COALESCE(ep_d.banque, 'CAISSE') as banque, COALESCE(d."dateEcheance", d.date) as "dateEcheance", 
          d.date as "dateEncaissement", d.montant as "montantHT", ep_d.id as "echeanceId"
        FROM "Depense" d
        LEFT JOIN "Fournisseur" f ON d."fournisseurId" = f.id
        LEFT JOIN "FactureFournisseur" inv_d ON d."factureFournisseurId" = inv_d.id
        LEFT JOIN "Fournisseur" ff_d ON inv_d."fournisseurId" = ff_d.id
        LEFT JOIN "EcheancePaiement" ep_d ON d."echeanceId" = ep_d.id
        ${depenseWhere}
      `);
    }

    if (includeFacture) {
      parts.push(`
        SELECT 
          ep.id, ${echeanceDateField} as date, 
          CASE WHEN ff.id IS NOT NULL THEN '[F] ' || ff."numeroFacture" ELSE '[Paiement direct] ' || COALESCE(ep.reference, '') END as libelle,
          COALESCE(ff.type, 'ACHAT_STOCK') as type, 
          COALESCE(f_ff.nom, 'N/A') as fournisseur, ep.montant, ep.statut, 'FACTURE' as source, 
          ep.type as "methodePaiement", ep.reference as "numeroPiece", 
          COALESCE(ep.banque, 'BANQUE') as banque, ep."dateEcheance", ep."dateEncaissement", 
          CASE WHEN ff.id IS NOT NULL AND ff."montantTTC" > 0 THEN (ep.montant * (ff."montantHT" / ff."montantTTC")) ELSE ep.montant END as "montantHT", 
          ep.id as "echeanceId"
        FROM "EcheancePaiement" ep
        LEFT JOIN "FactureFournisseur" ff ON ep."factureFournisseurId" = ff.id
        LEFT JOIN "Fournisseur" f_ff ON COALESCE(ff."fournisseurId", (SELECT "fournisseurId" FROM "BonLivraison" WHERE id = ep."bonLivraisonId" LIMIT 1)) = f_ff.id
        ${echeanceWhere}
        AND ep.id NOT IN (SELECT "echeanceId" FROM "Depense" WHERE "echeanceId" IS NOT NULL)
        AND (ep.statut IN (${this.getPaidStatusesSQL()}) OR (ep.reference IS NOT NULL AND ep.reference <> '') OR (ep.montant > 0 AND ep."dateEcheance" IS NOT NULL AND ep."factureFournisseurId" IS NOT NULL AND ff.type <> 'BL'))
      `);
    }

    return { query: parts.join(' UNION ALL '), params: sqlParams };
  }

  getIncomingsBaseSQL(filters: any) {
    const sqlParams: any[] = [];
    let whereClause = 'WHERE 1=1 ';

    if (filters.centreId) {
      sqlParams.push(filters.centreId);
      whereClause += `AND f."centreId" = $${sqlParams.length} `;
    }

    if (filters.statut && filters.statut !== 'ALL') {
      sqlParams.push(filters.statut);
      whereClause += `AND p.statut = $${sqlParams.length} `;
    }

    const modeVal = filters.mode || filters.modePaiement;
    if (modeVal && modeVal !== 'ALL') {
      const allModes = this.getNormalizedModes(modeVal);
      const inClause = allModes
        .map((_, i) => `$${sqlParams.length + i + 1}`)
        .join(', ');
      allModes.forEach((m) => sqlParams.push(m));
      whereClause += `AND p.mode IN (${inClause}) `;
    }

    const dateField =
      filters.dateType === 'EMISSION' ? 'f."dateEmission"' : 'p.date';
    if (filters.startDate && filters.endDate) {
      sqlParams.push(new Date(filters.startDate), new Date(filters.endDate));
      whereClause += `AND ${dateField} >= $${sqlParams.length - 1} AND ${dateField} <= $${sqlParams.length} `;
    }

    const query = `
      SELECT 
        p.id, p.date, p.montant, p.statut, p.mode, f."dateEmission" as "factureDate",
        COALESCE(f.numero, 'N/A') as libelle,
        COALESCE(c.nom, '') || ' ' || COALESCE(c.prenom, '') as client,
        p.reference as "numeroPiece", p.banque
      FROM "Paiement" p
      LEFT JOIN "Facture" f ON p."factureId" = f.id
      LEFT JOIN "Client" c ON f."clientId" = c.id
      ${whereClause}
    `;

    return { query, params: sqlParams };
  }

  private getNormalizedModes(modeVal: string): string[] {
    const modes = modeVal.split(',').map((m) => m.trim().toUpperCase());
    const allModes: string[] = [];
    for (const m of modes) {
      if (m === 'CHEQUE')
        allModes.push('CHEQUE', 'Chèque', 'CHÈQUE', 'Chéque', 'CHÉQUE');
      else if (m === 'LCN') allModes.push('LCN', 'EFFET', 'Effet', 'Traite');
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
      else if (['PRISE_EN_CHARGE', 'PRISE EN CHARGE', 'PEC'].includes(m))
        allModes.push('PRISE_EN_CHARGE', 'PRISE EN CHARGE', 'PEC');
      else allModes.push(m);
    }
    return allModes;
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
    const startStr =
      startDateStr || `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr =
      endDateStr ||
      `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const paidStatuses = [
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
    const pendingStatuses = [
      'EN_ATTENTE',
      'PORTEFEUILLE',
      'REMIS_EN_BANQUE',
      'DEPOSE',
    ];

    // 1. Incomings (Paiements)
    const inStats = await this.prisma.paiement.aggregate({
      where: {
        facture: { centreId: normalizedCentreId },
        date: { gte: startDate, lte: endDate },
      },
      _sum: { montant: true },
      _count: { _all: true },
    });

    const inPaidStats = await this.prisma.paiement.aggregate({
      where: {
        facture: { centreId: normalizedCentreId },
        date: { gte: startDate, lte: endDate },
        statut: { in: paidStatuses },
      },
      _sum: { montant: true },
    });

    const inPendingStats = await this.prisma.paiement.aggregate({
      where: {
        facture: { centreId: normalizedCentreId },
        date: { gte: startDate, lte: endDate },
        statut: { in: pendingStatuses },
      },
      _sum: { montant: true },
    });

    const inCashStats = await this.prisma.paiement.aggregate({
      where: {
        facture: { centreId: normalizedCentreId },
        date: { gte: startDate, lte: endDate },
        statut: { in: paidStatuses },
        mode: {
          in: ['ESPECES', 'LIQUIDE', 'CASH', 'ESPÈCES', 'ESPÈCE', 'ESPECE'],
        },
      },
      _sum: { montant: true },
    });

    const inCardStats = await this.prisma.paiement.aggregate({
      where: {
        facture: { centreId: normalizedCentreId },
        date: { gte: startDate, lte: endDate },
        statut: { in: paidStatuses },
        mode: { in: ['CARTE', 'CARTE BANCAIRE', 'CB', 'TPE'] },
      },
      _sum: { montant: true },
    });

    const inPecStats = await this.prisma.paiement.aggregate({
      where: {
        facture: { centreId: normalizedCentreId },
        date: { gte: startDate, lte: endDate },
        mode: { in: ['PRISE_EN_CHARGE', 'PRISE EN CHARGE', 'PEC'] },
      },
      _sum: { montant: true },
      _count: { _all: true },
    });

    // 2. Outgoings (Depenses & Echeances)
    // For summary, we can use raw SQL for the complex union but keep it simple
    const outEmission = this.getOutgoingsBaseSQL({
      centreId: normalizedCentreId,
      startDate: startStr,
      endDate: endStr,
      dateType: 'EMISSION',
    });
    const outEcheance = this.getOutgoingsBaseSQL({
      centreId: normalizedCentreId,
      startDate: startStr,
      endDate: endStr,
      dateType: 'ECHEANCE',
    });

    const [emissionStats, echeanceStats, config] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT montant as total, type, source as cat FROM (${outEmission.query}) as c`,
        ...outEmission.params,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT 
          COALESCE(SUM(montant), 0)::float as total, 
          COALESCE(SUM(CASE WHEN statut IN (${this.getPaidStatusesSQL()}) THEN montant ELSE 0 END), 0)::float as paid,
          COALESCE(SUM(CASE WHEN statut IN ('REMIS_EN_BANQUE', 'DEPOSE', 'REMIS', 'DÉPOSÉ') THEN montant ELSE 0 END), 0)::float as remis,
          COALESCE(SUM(CASE WHEN statut IN ('EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS') THEN montant ELSE 0 END), 0)::float as pending
        FROM (${outEcheance.query}) as c
      `,
        ...outEcheance.params,
      ),
      this.getConfig(),
    ]);

    let totalEngaged = 0;
    const combinedCategoriesMap = new Map<string, number>();
    emissionStats.forEach((s) => {
      const amount = Number(s.total || 0);
      totalEngaged += amount;
      let cat = s.type || 'AUTRE';
      if (this.INVENTORY_PURCHASE_TYPES.includes(cat)) {
        if (cat.includes('MONTURE')) cat = 'ACHAT MONTURES';
        else if (cat.includes('VERRE')) cat = 'ACHAT VERRES';
        else cat = 'ACHAT STOCK (Divers)';
      } else
        cat =
          s.cat === 'DEPENSE' ? s.type || 'DEPENSE' : 'ACHAT STOCK (Divers)';
      combinedCategoriesMap.set(
        cat,
        (combinedCategoriesMap.get(cat) || 0) + amount,
      );
    });

    const eStats = echeanceStats[0] || {
      total: 0,
      paid: 0,
      remis: 0,
      pending: 0,
    };

    return {
      month,
      year,
      totalExpenses: totalEngaged,
      totalIncoming: Number(inStats._sum?.montant || 0),
      totalExpensesCashed: Number(eStats.paid || 0),
      totalIncomingCashed: Number(inPaidStats._sum?.montant || 0),
      balance: Number(inStats._sum?.montant || 0) - Number(eStats.total || 0),
      balanceReal:
        Number(inPaidStats._sum?.montant || 0) - Number(eStats.paid || 0),
      totalScheduled: Number(eStats.total || 0),
      totalIncomingPending: Number(inPendingStats._sum?.montant || 0),
      totalOutgoingPending: Number(eStats.pending || 0),
      totalOutgoingRemis: Number(eStats.remis || 0),
      monthlyThreshold: config.monthlyThreshold || 50000,
      stockCategories: Array.from(combinedCategoriesMap.entries())
        .filter(([n]) => n.includes('ACHAT'))
        .map(([name, value]) => ({ name, value })),
      expenseCategories: Array.from(combinedCategoriesMap.entries())
        .filter(([n]) => !n.includes('ACHAT'))
        .map(([name, value]) => ({ name, value })),
      incomingCash: Number(inCashStats._sum?.montant || 0),
      incomingCard: Number(inCardStats._sum?.montant || 0),
      incomingPriseEnCharge: Number(inPecStats._sum?.montant || 0),
      countPriseEnCharge: Number((inPecStats._count as any)?._all || 0),
      alerts: await this.getPendingAlerts(normalizedCentreId),
    };
  }

  async getConsolidatedOutgoings(filters: any) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const sqlBase = this.getOutgoingsBaseSQL(filters);
    const [stats, data] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT 
          COUNT(*)::int as total, 
          COALESCE(SUM(montant), 0)::float as "totalTTC", 
          COALESCE(SUM("montantHT"), 0)::float as "totalHT", 
          COALESCE(SUM(CASE WHEN statut IN ('EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS', 'BROUILLON', 'A_PAYER') THEN montant ELSE 0 END), 0)::float as "inHand", 
          COALESCE(SUM(CASE WHEN statut IN ('REMIS_EN_BANQUE', 'DEPOSE', 'REMIS', 'DÉPOSÉ') THEN montant ELSE 0 END), 0)::float as "deposited",
          COALESCE(SUM(CASE WHEN statut IN (${this.getPaidStatusesSQL()}) THEN montant ELSE 0 END), 0)::float as "paid" 
        FROM (${sqlBase.query}) as c
      `,
        ...sqlBase.params,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `${sqlBase.query} ORDER BY date DESC LIMIT ${limit} OFFSET ${skip}`,
        ...sqlBase.params,
      ),
    ]);

    const s = stats[0] || {
      total: 0,
      totalTTC: 0,
      totalHT: 0,
      inHand: 0,
      paid: 0,
      deposited: 0,
    };
    return {
      data: data.map((r) => ({
        ...r,
        libelle: this.cleanText(r.libelle),
        fournisseur: this.cleanText(r.fournisseur),
        montant: Number(r.montant || 0),
      })),
      total: s.total,
      subtotals: {
        totalTTC: Number(s.totalTTC || 0),
        inHand: Number(s.inHand || 0),
        deposited: Number(s.deposited || 0),
        paid: Number(s.paid || 0),
        totalHT: Number(s.totalHT || 0),
      },
    };
  }

  async getConsolidatedIncomings(filters: any) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const sqlBase = this.getIncomingsBaseSQL(filters);
    const [stats, data] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT 
          COUNT(*)::int as total, 
          COALESCE(SUM(montant), 0)::float as "totalTTC", 
          COALESCE(SUM(CASE WHEN statut IN ('EN_ATTENTE', 'PORTEFEUILLE', 'EN_COURS', 'BROUILLON') THEN montant ELSE 0 END), 0)::float as "inHand", 
          COALESCE(SUM(CASE WHEN statut IN ('REMIS_EN_BANQUE', 'DEPOSE', 'REMIS', 'DÉPOSÉ') THEN montant ELSE 0 END), 0)::float as "deposited",
          COALESCE(SUM(CASE WHEN statut IN (${this.getPaidStatusesSQL()}) THEN montant ELSE 0 END), 0)::float as "paid" 
        FROM (${sqlBase.query}) as c
      `,
        ...sqlBase.params,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `${sqlBase.query} ORDER BY date DESC LIMIT ${limit} OFFSET ${skip}`,
        ...sqlBase.params,
      ),
    ]);

    const s = stats[0] || {
      total: 0,
      totalTTC: 0,
      inHand: 0,
      paid: 0,
      deposited: 0,
    };
    return {
      data: data.map((r) => ({
        ...r,
        source: 'FACTURE_CLIENT',
        fournisseur: r.client,
        montant: Number(r.montant || 0),
        methodePaiement: r.mode,
      })),
      total: s.total,
      subtotals: {
        totalTTC: Number(s.totalTTC || 0),
        inHand: Number(s.inHand || 0),
        deposited: Number(s.deposited || 0),
        paid: Number(s.paid || 0),
      },
    };
  }

  async getConsolidatedUnpaid(filters: any) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;
    if (!filters.centreId)
      return { data: [], total: 0, subtotals: { totalTTC: 0, totalReste: 0 } };

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

    const baseWhere = {
      centreId: filters.centreId,
      statut: { notIn: ['ANNULEE', 'ARCHIVE'] },
      ...dateFilter,
    };
    if (filters.clientId) (baseWhere as any).clientId = filters.clientId;

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
    const [factureAgg, bcAgg, avoirAgg, data] = await Promise.all([
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
        include: { client: true },
        orderBy: { dateEmission: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalTTC =
      (factureAgg._sum?.totalTTC || 0) +
      (bcAgg._sum?.totalTTC || 0) -
      (avoirAgg._sum?.totalTTC || 0);
    const totalReste =
      (factureAgg._sum?.resteAPayer || 0) +
      (bcAgg._sum?.resteAPayer || 0) -
      (avoirAgg._sum?.resteAPayer || 0);
    const totalCount =
      ((factureAgg._count as any)?._all || 0) +
      ((bcAgg._count as any)?._all || 0) +
      ((avoirAgg._count as any)?._all || 0);

    return {
      data: data.map((f) => ({
        id: f.id,
        date: f.dateEmission || f.createdAt,
        libelle: `Facture ${f.numero}`,
        numero: f.numero,
        type: f.type,
        fournisseur: f.client
          ? `${f.client.nom || ''} ${f.client.prenom || ''}`.trim()
          : 'N/A',
        montant: Number(f.totalTTC || 0),
        resteAPayer: Number(f.resteAPayer || 0),
        statut: f.statut,
      })),
      total: totalCount,
      subtotals: { totalTTC, totalReste },
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
        const lastDay = new Date(year, month, 0)
          .getDate()
          .toString()
          .padStart(2, '0');
        const outgoingsQuery = this.getOutgoingsBaseSQL({
          centreId: normalizedCentreId,
          startDate: `${yearStr}-${monthStr}-01`,
          endDate: `${yearStr}-${monthStr}-${lastDay}`,
          dateType: 'ECHEANCE',
        });
        const stats = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
          `SELECT COALESCE(SUM(montant), 0)::float as total FROM (${outgoingsQuery.query}) as c`,
          ...outgoingsQuery.params,
        );
        return Number(stats[0]?.total || 0);
      }),
    );
    return results.map((total, i) => ({ month: i + 1, totalExpenses: total }));
  }

  async updateEcheanceStatus(id: string, statut: string) {
    const updateData: any = { statut };
    if (statut === 'ENCAISSE' || statut === 'PAYE')
      updateData.dateEncaissement = new Date();

    const updatedEcheance = await this.prisma.echeancePaiement.update({
      where: { id },
      data: updateData,
    });

    // Synchroniser le statut de la Depense liee (si elle existe)
    const linkedDepense = await this.prisma.depense.findFirst({
      where: { echeanceId: id },
    });
    if (linkedDepense) {
      // Mapper le statut EcheancePaiement vers le statut Depense equivalent
      let depenseStatut = statut;
      if (statut === 'ENCAISSE') depenseStatut = 'PAYE';
      // REMIS_EN_BANQUE, EN_ATTENTE, PAYE restent identiques

      await this.prisma.depense.update({
        where: { id: linkedDepense.id },
        data: { statut: depenseStatut },
      });
    }

    return updatedEcheance;
  }

  async getConfig() {
    let config = await this.prisma.financeConfig.findFirst();
    if (!config)
      config = await this.prisma.financeConfig.create({
        data: { monthlyThreshold: 50000 },
      });
    return config;
  }

  async updateConfig(threshold: number) {
    const config = await this.getConfig();
    return this.prisma.financeConfig.update({
      where: { id: config.id },
      data: { monthlyThreshold: threshold },
    });
  }

  async getPendingAlerts(centreId?: string) {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const next48h = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    // Tous les types de cheques avec leurs variantes d'encodage
    const chequeTypes = ["CHEQUE","LCN","Chèque","Chéque","Ch├¿que","cheque","Cheque"];

    const baseWhere: any = {
      // Pas de borne inferieure : inclure TOUS les elements en retard + 48h a venir
      dateEcheance: { lte: next48h },
      statut: { in: ['EN_ATTENTE', 'REMIS_EN_BANQUE'] },
      type: { in: chequeTypes },
      ...(centreId
        ? {
            OR: [
              { depense: { centreId } },
              { factureFournisseur: { centreId } },
              { bonLivraison: { centreId } },
            ],
          }
        : {}),
    };

    const [clientAlerts, supplierAlerts] = await Promise.all([
      this.prisma.paiement.findMany({
        where: {
          mode: { in: chequeTypes },
          statut: { in: ['EN_ATTENTE', 'REMIS_EN_BANQUE'] },
          // Tous les paiements non encaisses (passes + futurs jusqu'a 24h)
          dateVersement: { lte: next24h },
          facture: centreId ? { centreId } : {},
        },
        include: { facture: { include: { client: true } } },
        orderBy: { dateVersement: 'asc' },
        take: 50,
      }),
      this.prisma.echeancePaiement.findMany({
        where: baseWhere,
        include: {
          factureFournisseur: { include: { fournisseur: true } },
          depense: { include: { fournisseur: true } },
          bonLivraison: { include: { fournisseur: true } },
        },
        orderBy: { dateEcheance: 'asc' },
        take: 50,
      }),
    ])
    return {
      client: clientAlerts.map((p) => ({
        id: p.id,
        client:
          `${p.facture.client?.nom || ''} ${p.facture.client?.prenom || ''}`.trim(),
        montant: p.montant,
        date: p.dateVersement,
        reference: p.reference || 'N/A',
        numeroFacture: p.facture.numero,
        statut: p.statut,
      })),
      supplier: supplierAlerts.map((e) => ({
        id: e.id,
        fournisseur:
          e.factureFournisseur?.fournisseur?.nom ||
          e.depense?.fournisseur?.nom ||
          e.bonLivraison?.fournisseur?.nom ||
          'N/A',
        montant: e.montant,
        date: e.dateEcheance,
        reference: e.reference || 'N/A',
        source: e.factureFournisseur
          ? 'FACTURE'
          : e.bonLivraison
            ? 'BL'
            : 'DEPENSE',
        statut: e.statut,
      })),
    };
  }

  private cleanText(text: string): string {
    if (!text) return 'N/A';
    return text
      .replace(/r[\W_]*glement/gi, 'Règlement')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
