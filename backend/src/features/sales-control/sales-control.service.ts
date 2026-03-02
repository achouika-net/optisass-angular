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
        type: 'BON_COMMANDE',
        ...(start || end ? { dateEmission: { gte: start, lte: end } } : {}),
      },
      include: {
        client: { select: { nom: true, prenom: true, raisonSociale: true } },
        paiements: true,
        fiche: true,
      },
      orderBy: [{ fiche: { numero: 'desc' } }, { dateEmission: 'desc' }],
      take: take || 10,
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
      take: take || 10,
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
        statut: { notIn: ['ANNULEE', 'ARCHIVE'] },
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
      orderBy: [{ fiche: { numero: 'desc' } }, { dateEmission: 'desc' }],
      take: take || 10,
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
      orderBy: [{ fiche: { numero: 'desc' } }, { dateEmission: 'desc' }],
      take: take || 10,
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
        type: 'BON_COMMANDE' as any,
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
  ) {
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

    const [
      factureMetrics,
      bcMetrics,
      avoirMetrics,
      devisCount,
      withPayments,
      withoutPayments,
      valid,
      avoirs,
      paymentAgg,
    ] = await Promise.all([
      // Factures Metrics (Tab 3)
      this.prisma.facture.aggregate({
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true },
        where: {
          centreId,
          type: 'FACTURE',
          statut: { notIn: ['ANNULEE', 'ARCHIVE'] },
          ...dateFilter,
        },
      }),
      // BC Metrics (Tab 1)
      this.prisma.facture.aggregate({
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true },
        where: {
          centreId,
          type: 'BON_COMMANDE',
          statut: { notIn: ['ANNULEE', 'ARCHIVE'] },
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
      // Devis Count (Tab 2) - Simplified count for badge
      this.prisma.facture.count({
        where: {
          centreId,
          statut: { notIn: ['ARCHIVE', 'ANNULEE', 'VENTE_EN_INSTANCE'] },
          paiements: { none: {} },
          type: { notIn: ['BON_COMMANDE', 'BON_COMM'] },
          numero: { not: { startsWith: 'BC' } },
          ...dateFilter,
        },
      }),

      // Limited lists for the tabs (pagination)
      this.getBrouillonWithPayments(userId, centreId, startDate, endDate, 10),
      this.getBrouillonWithoutPayments(userId, centreId, startDate, endDate, 10),
      this.getValidInvoices(userId, centreId, startDate, endDate, 10),
      this.getAvoirs(userId, centreId, startDate, endDate, 10),
      // Payments Breakdown
      this.prisma.paiement.findMany({
        where: {
          ...paymentDateFilter,
          facture: { centreId },
        },
        select: { mode: true, montant: true },
      }),
    ]);

    const totalFactures = factureMetrics._sum.totalTTC || 0;
    const totalAvoirs = avoirMetrics._sum.totalTTC || 0;
    const totalBC = bcMetrics._sum.totalTTC || 0;

    // CA Global = Factures + BC - Avoirs
    const totalAmount = totalFactures + totalBC - totalAvoirs;

    const totalFacturesReste = factureMetrics._sum.resteAPayer || 0;
    const totalBMReste = bcMetrics._sum.resteAPayer || 0;
    const totalAvoirsReste = avoirMetrics._sum.resteAPayer || 0;
    const totalReste = totalFacturesReste + totalBMReste - totalAvoirsReste;

    const paymentMap = new Map<string, number>();
    for (const p of paymentAgg as { mode: string; montant: number }[]) {
      const m = p.mode || 'AUTRE';
      paymentMap.set(m, (paymentMap.get(m) || 0) + p.montant);
    }

    const payments = Array.from(paymentMap.entries()).map(
      ([methode, total]) => ({
        methode,
        total,
      }),
    );
    const totalEncaissePeriod = payments.reduce((sum, p) => sum + p.total, 0);

    const stats = [
      {
        vendorId: 'all',
        vendorName: 'Tous les vendeurs',
        countValid: factureMetrics._count._all,
        countWithPayment: bcMetrics._count._all,
        countWithoutPayment: devisCount,
        countAvoir: avoirMetrics._count._all,
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
