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
      orderBy: [{ dateEmission: 'desc' }],
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
      // Valid Factures to extract ficheIds (We need the factures metrics too now since we replaced its aggregate)
      this.prisma.facture.findMany({
        where: {
          centreId,
          type: 'FACTURE',
          ...dateFilter,
        },
        select: { totalTTC: true, resteAPayer: true, ficheId: true },
      }),
      // Raw BCs to filter against Factures
      this.prisma.facture.findMany({
        where: {
          centreId,
          type: { in: ['BON_COMMANDE', 'BON_COMM'] },
          statut: { notIn: ['ARCHIVE'] },
          ...dateFilter,
        },
        select: { totalTTC: true, resteAPayer: true, ficheId: true },
      }),
      // Avoirs Metrics
      this.prisma.facture.aggregate({
        _sum: { totalTTC: true, resteAPayer: true },
        _count: { _all: true },
        where: {
          centreId,
          type: 'AVOIR',
          statut: { notIn: ['ARCHIVE'] },
          ...dateFilter,
        },
      }),
      // Devis Count (Tab 2) - Simplified count for badge
      this.prisma.facture.count({
        where: {
          centreId,
          statut: { notIn: ['ARCHIVE', 'VENTE_EN_INSTANCE'] },
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

    // Filter out BCs that share a ficheId with a valid facture
    const facturesFicheIds = new Set(
      factureMetrics.map((f: any) => f.ficheId).filter((id: string | null) => id)
    );
    const validStandaloneBCs = bcMetrics.filter(
      (bc: any) => !bc.ficheId || !facturesFicheIds.has(bc.ficheId)
    );

    const totalFactures = factureMetrics.reduce((sum: number, f: any) => sum + (f.totalTTC || 0), 0);
    const totalAvoirs = avoirMetrics._sum.totalTTC || 0;
    const totalBC = validStandaloneBCs.reduce((sum: number, bc: any) => sum + (bc.totalTTC || 0), 0);

    // CA Global = Factures + BC - Avoirs
    const totalAmount = totalFactures + totalBC - totalAvoirs;

    const totalFacturesReste = factureMetrics.reduce((sum: number, f: any) => sum + (f.resteAPayer || 0), 0);
    const totalBMReste = validStandaloneBCs.reduce((sum: number, bc: any) => sum + (bc.resteAPayer || 0), 0);
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
        countValid: factureMetrics.length,
        countWithPayment: validStandaloneBCs.length,
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
