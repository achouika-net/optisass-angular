import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FacturesService } from '../factures/factures.service';

@Injectable()
export class SalesControlService {
  constructor(
    private prisma: PrismaService,
    private facturesService: FacturesService,
  ) { }

  // Tab 1: Bons de Commande = "Ventes sans facture" (type BON_COMMANDE)
  async getBrouillonWithPayments(
    userId?: string,
    centreId?: string,
    startDate?: string,
    endDate?: string,
    take?: number,
  ) {
    if (!centreId) return [];
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // A "Bon de Commande" (BC) is a draft sale with payments or a document explicitly marked as BC.
    // We must exclude documents that are already considered "Official Sales" (Factures) in Tab 3 to avoid double counting.
    return this.prisma.facture.findMany({
      where: {
        centreId,
        statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
        type: { in: ['BON_COMMANDE', 'BON_COMM'] },
        OR: [
          { notes: { not: { contains: 'Remplacée par' } } },
          { notes: null }
        ],
        ...(start || end ? { dateEmission: { gte: start, lte: end } } : {}),
      },
      include: {
        client: { select: { nom: true, prenom: true, raisonSociale: true } },
        paiements: true,
        fiche: true,
      },
      orderBy: [{ fiche: { numero: 'desc' } }, { dateEmission: 'desc' }],
    });
  }

  // Tab 2: Devis
  async getBrouillonWithoutPayments(
    userId?: string,
    centreId?: string,
    startDate?: string,
    endDate?: string,
    take?: number,
  ) {
    if (!centreId) return [];
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const results = await this.prisma.facture.findMany({
      where: {
        centreId,
        statut: { notIn: ['ARCHIVE', 'ANNULEE', 'VENTE_EN_INSTANCE'] },
        paiements: { none: {} },
        ...(start || end ? { dateEmission: { gte: start, lte: end } } : {}),
      },
      include: {
        client: { select: { nom: true, prenom: true, raisonSociale: true } },
        fiche: true,
      },
      orderBy: [{ fiche: { numero: 'desc' } }, { dateEmission: 'desc' }],
    });

    return results.filter((f) => {
      const isBC =
        f.type === 'BON_COMMANDE' ||
        f.type === 'BON_COMM' ||
        (f.numero || '').startsWith('BC');
      if (isBC) return false;
      const num = (f.numero || '').toUpperCase();
      return (
        f.type === 'DEVIS' ||
        num.startsWith('BRO') ||
        num.startsWith('DEV') ||
        num.startsWith('DEVIS')
      );
    });
  }

  // Tab 3: Factures = "Ventes avec facture"
  // During import, these were stored as type=DEVIS (vente avec facture) or type=FACTURE
  // They are identified by: type FACTURE, numero starting with FAC, OR type DEVIS
  async getValidInvoices(
    userId?: string,
    centreId?: string,
    startDate?: string,
    endDate?: string,
    take?: number,
  ) {
    if (!centreId) return [];
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.prisma.facture.findMany({
      where: {
        centreId,
        type: 'FACTURE',
        statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
        ...(start || end ? { dateEmission: { gte: start, lte: end } } : {}),
      },
      include: {
        client: { select: { nom: true, prenom: true, raisonSociale: true } },
        paiements: true,
        fiche: true,
        children: {
          select: { id: true, numero: true, type: true, statut: true },
        },
      },
      orderBy: [{ dateEmission: 'desc' }],
    });
  }

  // Tab 4: AVOIRS
  async getAvoirs(
    userId?: string,
    centreId?: string,
    startDate?: string,
    endDate?: string,
    take?: number,
  ) {
    if (!centreId) return [];
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.prisma.facture.findMany({
      where: {
        centreId,
        type: 'AVOIR',
        ...(start || end ? { dateEmission: { gte: start, lte: end } } : {}),
      },
      include: {
        client: { select: { nom: true, prenom: true, raisonSociale: true } },
        paiements: true,
        fiche: true,
        parentFacture: { select: { id: true, numero: true } },
      },
      orderBy: [{ dateEmission: 'desc' }],
    });
  }

  // Tab: Statistics (Now compatible with Dashboard Data)
  async getStatisticsByVendor(
    centreId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    if (!centreId) return [];
    const dashboard = await this.getDashboardData(
      undefined,
      centreId,
      startDate,
      endDate,
    );
    return dashboard.stats;
  }

  // Validate invoice - handles both DEVIS→BC and BC→FACTURE transitions
  async validateInvoice(id: string) {
    const currentDoc = await this.prisma.facture.findUnique({ where: { id } });
    if (!currentDoc) throw new Error(`Document ${id} not found`);

    if (currentDoc.type === 'BON_COMMANDE' || currentDoc.type === 'BON_COMM') {
      return this.facturesService.update({
        where: { id },
        data: {
          type: 'FACTURE' as any,
          statut: 'VALIDE',
          proprietes: { forceFiscal: true },
        },
      });
    }

    return this.facturesService.update({
      where: { id },
      data: {
        type: 'BON_COMM' as any,
        statut: 'VENTE_EN_INSTANCE',
        proprietes: { forceStockDecrement: true },
      },
    });
  }

  // Consolidated dashboard data - Optimized for high performance
  async getDashboardData(
    userId?: string,
    centreId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    withPayments: any[];
    withoutPayments: any[];
    valid: any[];
    avoirs: any[];
    stats: any[];
    payments: any[];
  }> {
    if (!centreId) {
      return {
        withPayments: [],
        withoutPayments: [],
        valid: [],
        avoirs: [],
        stats: [],
        payments: [],
      };
    }

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    // 1. Fetch metrics and initial tab data in parallel
    const dateFilter =
      start || end ? { dateEmission: { gte: start, lte: end } } : {};
    const paymentDateFilter =
      start || end ? { date: { gte: start, lte: end } } : {};

    // First, get the ficheIds of all real Factures in this period to avoid double counting BCs
    const facturesWithFiche = await this.prisma.facture.findMany({
      where: {
        centreId,
        type: 'FACTURE',
        ficheId: { not: null },
        ...dateFilter,
      },
      select: { ficheId: true },
    });
    const factureFicheIds = facturesWithFiche
      .map((f) => f.ficheId)
      .filter((id): id is string => !!id);

    const [
      factureAgg,
      bcAgg,
      avoirAgg,
      devisCount,
      withPayments,
      withoutPayments,
      valid,
      avoirs,
      paymentAgg,
    ] = await Promise.all([
      // Factures Metrics
      this.prisma.facture.aggregate({
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true },
        where: {
          centreId,
          type: 'FACTURE',
          statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
          ...dateFilter,
        },
      }),
      // BC Metrics (Excluding those with a corresponding Facture)
      this.prisma.facture.aggregate({
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true },
        where: {
          centreId,
          type: { in: ['BON_COMMANDE', 'BON_COMM'] },
          statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
          ficheId: { notIn: factureFicheIds },
          OR: [
            { notes: { not: { contains: 'Remplacée par' } } },
            { notes: null }
          ],
          ...dateFilter,
        },
      }),
      // Avoirs Metrics
      this.prisma.facture.aggregate({
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true },
        where: {
          centreId,
          type: 'AVOIR',
          statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
          ...dateFilter,
        },
      }),
      // Devis Count (Tab 2)
      this.prisma.facture.count({
        where: {
          centreId,
          statut: { notIn: ['ARCHIVE', 'ANNULEE', 'VENTE_EN_INSTANCE'] },
          paiements: { none: {} },
          type: { notIn: ['BON_COMMANDE', 'BON_COMM', 'FACTURE', 'AVOIR'] },
          numero: { not: { startsWith: 'BC' } },
          ...dateFilter,
        },
      }),

      // Limited lists for the tabs (pagination)
      this.getBrouillonWithPayments(userId, centreId, startDate, endDate),
      this.getBrouillonWithoutPayments(userId, centreId, startDate, endDate),
      this.getValidInvoices(userId, centreId, startDate, endDate),
      this.getAvoirs(userId, centreId, startDate, endDate),

      // Payments Breakdown (Aggregated by mode)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // RÈGLE D'OR : Encaissé doit avoir EXACTEMENT le même périmètre
      // de documents que le CA Global, sinon l'identité échoue :
      //    Encaissé + Reste à Recouvrir ≠ CA Global
      //
      // Périmètre CA :
      //   1. FACTURES actives
      //   2. AVOIRS actifs
      //   3. BCs actifs NON convertis en FACTURE (déduplication ficheId + notes)
      //
      // → On applique la même déduplication BC ici.
      //   Les paiements sur des BCs exclus du CA ne sont pas dans l'Encaissé.
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      this.prisma.paiement.groupBy({
        by: ['mode'],
        _sum: { montant: true },
        where: {
          date: paymentDateFilter.date,
          statut: { not: 'ANNULE' },
          facture: {
            centreId,
            statut: { notIn: ['ARCHIVE', 'ANNULEE'] as any[] },
            OR: [
              // Factures officielles et avoirs (toujours inclus)
              { type: { in: ['FACTURE', 'AVOIR'] } },
              // BCs inclus dans le CA (non dédupliqués, même logique que bcAgg)
              {
                type: { in: ['BON_COMMANDE', 'BON_COMM'] },
                ficheId: { notIn: factureFicheIds },
                OR: [
                  { notes: { not: { contains: 'Remplacée par' } } },
                  { notes: null },
                ],
              },
            ],
          },
        },
      }),
    ]);

    const totalFactures = factureAgg._sum.totalTTC || 0;
    const totalAvoirs = avoirAgg._sum.totalTTC || 0;
    const totalBC = bcAgg._sum.totalTTC || 0;

    // CA Global = Factures + BC - Avoirs
    const totalAmount = totalFactures + totalBC - totalAvoirs;

    const totalFacturesReste = factureAgg._sum.resteAPayer || 0;
    const totalBMReste = bcAgg._sum.resteAPayer || 0;
    const totalAvoirsReste = avoirAgg._sum.resteAPayer || 0;
    const totalReste = totalFacturesReste + totalBMReste - totalAvoirsReste;

    // Harmonize payment modes for clean display
    const mergedPayments = new Map<string, number>();
    paymentAgg.forEach((p) => {
      const rawMode = (p.mode || 'AUTRE').toUpperCase();
      let mode = rawMode;
      
      // Grouping rules
      if (['ESPECES', 'LIQUIDE', 'CASH', 'ESPÈCES', 'ESPÈCE'].includes(rawMode)) {
        mode = 'ESPÈCES';
      } else if (['CARTE', 'CB', 'TPE', 'CARTE BANCAIRE'].includes(rawMode)) {
        mode = 'CARTE';
      } else if (['CHEQUE', 'CHÈQUE'].includes(rawMode)) {
        mode = 'CHÈQUE';
      }

      const current = mergedPayments.get(mode) || 0;
      mergedPayments.set(mode, current + (p._sum.montant || 0));
    });

    const payments = Array.from(mergedPayments.entries()).map(([methode, total]) => ({
      methode,
      total,
    }));

    const totalEncaissePeriod = payments.reduce((sum, p) => sum + p.total, 0);

    const stats = [
      {
        vendorId: 'all',
        vendorName: 'Tous les vendeurs',
        countValid: factureAgg._count._all,
        countWithPayment: bcAgg._count._all,
        countWithoutPayment: devisCount,
        countAvoir: avoirAgg._count._all,
        totalAmount,
        totalFactures,
        totalAvoirs,
        totalBC,
        totalEncaissePeriod,
        totalReste,
        payments,
      },
    ];

    return { withPayments, withoutPayments, valid, avoirs, stats, payments };
  }

  async declareAsGift(id: string) {
    const facture = await this.prisma.facture.findUnique({ where: { id } });
    if (!facture) throw new Error('Facture not found');

    return this.prisma.facture.update({
      where: { id },
      data: {
        totalHT: 0,
        totalTVA: 0,
        totalTTC: 0,
        resteAPayer: 0,
        statut: 'VALIDE',
        proprietes: {
          ...(facture.proprietes as any),
          typeVente: 'DON',
          raison: 'Déclaré comme don/offert',
        },
      },
    });
  }

  async archiveInvoice(id: string) {
    return this.prisma.facture.update({
      where: { id },
      data: { statut: 'ARCHIVE' },
    });
  }
}
