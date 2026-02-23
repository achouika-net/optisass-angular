import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FacturesService } from '../factures/factures.service';

@Injectable()
export class SalesControlService {
    constructor(
        private prisma: PrismaService,
        private facturesService: FacturesService
    ) { }

    // Tab 1: Bons de Commande = "Ventes sans facture" (type BON_COMMANDE)
    async getBrouillonWithPayments(userId?: string, centreId?: string, startDate?: string, endDate?: string, take?: number) {
        if (!centreId) return [];
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        // "Bons de commande" actually means any document that has generated payments but is NOT technically a closed Official Sale yet. 
        // We broadly accept any document with payments, but we exclude official FACTURE types from this specific query to avoid double counting them here and in Tab 2, UNLESS the user wants them here. 
        // Actually, Tab 1 is meant for 'Vente en instance' (BCs). If a legacy DEVIS has a payment, it's effectively a BC.
        return this.prisma.facture.findMany({
            where: {
                centreId,
                statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
                // Include explicit BCs, AND any document that has payments but isn't a final FACTURE/BL/AVOIR
                OR: [
                    { type: { in: ['BON_COMMANDE', 'BON_COMM'] } },
                    {
                        paiements: { some: {} },
                        type: { notIn: ['FACTURE', 'BL', 'AVOIR'] }
                    }
                ],
                ...(start || end ? { dateEmission: { gte: start, lte: end } } : {})
            },
            include: {
                client: { select: { nom: true, prenom: true, raisonSociale: true } },
                paiements: true,
                fiche: true
            },
            orderBy: { dateEmission: 'desc' },
            take
        });
    }

    // Tab 2: Devis
    async getBrouillonWithoutPayments(userId?: string, centreId?: string, startDate?: string, endDate?: string, take?: number) {
        if (!centreId) return [];
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        const results = await this.prisma.facture.findMany({
            where: {
                centreId,
                statut: { notIn: ['ARCHIVE', 'ANNULEE', 'VENTE_EN_INSTANCE'] },
                paiements: { none: {} },
                ...(start || end ? { dateEmission: { gte: start, lte: end } } : {})
            },
            include: {
                client: { select: { nom: true, prenom: true, raisonSociale: true } },
                fiche: true
            },
            orderBy: { dateEmission: 'desc' },
            take
        });

        return results.filter(f => {
            const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM' || (f.numero || '').startsWith('BC');
            if (isBC) return false;
            const num = (f.numero || '').toUpperCase();
            return f.type === 'DEVIS' || num.startsWith('BRO') || num.startsWith('DEV') || num.startsWith('DEVIS');
        });
    }

    // Tab 3: Factures = "Ventes avec facture"
    // During import, these were stored as type=DEVIS (vente avec facture) or type=FACTURE
    // They are identified by: type FACTURE, numero starting with FAC, OR type DEVIS
    async getValidInvoices(userId?: string, centreId?: string, startDate?: string, endDate?: string, take?: number) {
        if (!centreId) return [];
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.prisma.facture.findMany({
            where: {
                centreId,
                type: { not: 'AVOIR' },
                statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
                // "Vente avec facture" stored as DEVIS, OR classic FAC/FACTURE documents
                OR: [
                    { numero: { startsWith: 'FAC' } },
                    { type: 'FACTURE' },
                    { type: 'DEVIS' }  // imported "vente avec facture" stored as DEVIS
                ],
                ...(start || end ? { dateEmission: { gte: start, lte: end } } : {})
            },
            include: {
                client: { select: { nom: true, prenom: true, raisonSociale: true } },
                paiements: true,
                fiche: true,
                children: { select: { id: true, numero: true, type: true, statut: true } }
            },
            orderBy: { dateEmission: 'desc' },
            take
        });
    }

    // Tab 4: AVOIRS
    async getAvoirs(userId?: string, centreId?: string, startDate?: string, endDate?: string, take?: number) {
        if (!centreId) return [];
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.prisma.facture.findMany({
            where: {
                centreId,
                type: 'AVOIR',
                ...(start || end ? { dateEmission: { gte: start, lte: end } } : {})
            },
            include: {
                client: { select: { nom: true, prenom: true, raisonSociale: true } },
                paiements: true,
                fiche: true,
                parentFacture: { select: { id: true, numero: true } }
            },
            orderBy: { numero: 'desc' },
            take
        });
    }

    // Tab: Statistics (Now compatible with Dashboard Data)
    async getStatisticsByVendor(centreId?: string, startDate?: string, endDate?: string) {
        if (!centreId) return [];
        const dashboard = await this.getDashboardData(undefined, centreId, startDate, endDate);
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
                    proprietes: { forceFiscal: true }
                }
            });
        }

        return this.facturesService.update({
            where: { id },
            data: {
                type: 'BON_COMMANDE' as any,
                statut: 'VENTE_EN_INSTANCE',
                proprietes: { forceStockDecrement: true }
            }
        });
    }

    // Consolidated dashboard data - Optimized for high performance
    async getDashboardData(userId?: string, centreId?: string, startDate?: string, endDate?: string) {
        if (!centreId) {
            return { withPayments: [], withoutPayments: [], valid: [], avoirs: [], stats: [], payments: [] };
        }

        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        // 1. Fetch metrics and initial tab data in parallel
        const dateFilter = (start || end) ? { dateEmission: { gte: start, lte: end } } : {};
        const paymentDateFilter = (start || end) ? { date: { gte: start, lte: end } } : {};

        const [
            factureMetrics,
            bcMetrics,
            avoirMetrics,
            totalResteMetrics,
            withPayments,
            withoutPayments,
            valid,
            avoirs,
            paymentAgg
        ] = await Promise.all([
            // Factures Metrics — "Vente avec facture" = DEVIS type + classic FACTURE/FAC documents
            this.prisma.facture.aggregate({
                _sum: { totalTTC: true },
                _count: true,
                where: {
                    centreId,
                    type: { not: 'AVOIR' },
                    statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
                    OR: [
                        { numero: { startsWith: 'FAC' } },
                        { type: 'FACTURE' },
                        { type: 'DEVIS' }  // "vente avec facture" imported as DEVIS
                    ],
                    ...dateFilter
                }
            }),
            // BC Metrics (Aligning with Tab 1 logic - Bons de Commande & Instances)
            this.prisma.facture.aggregate({
                _sum: { totalTTC: true },
                _count: true,
                where: {
                    centreId,
                    statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
                    OR: [
                        { statut: 'VENTE_EN_INSTANCE' },
                        { type: 'BON_COMMANDE' },
                        { type: 'BON_COMM' },
                        { numero: { startsWith: 'BC' } }
                    ],
                    ...dateFilter
                }
            }),
            // Avoirs Metrics
            this.prisma.facture.aggregate({
                _sum: { totalTTC: true },
                _count: true,
                where: {
                    centreId,
                    type: 'AVOIR',
                    statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
                    ...dateFilter
                }
            }),
            // Reste à Recouvrer (Period-based balance for center)
            this.prisma.facture.aggregate({
                _sum: { resteAPayer: true },
                where: {
                    centreId,
                    statut: { not: 'ANNULEE' },
                    ...dateFilter
                }
            }),
            // Limited lists for the tabs
            this.getBrouillonWithPayments(userId, centreId, startDate, endDate),
            this.getBrouillonWithoutPayments(userId, centreId, startDate, endDate),
            this.getValidInvoices(userId, centreId, startDate, endDate),
            this.getAvoirs(userId, centreId, startDate, endDate),
            // Payments Breakdown (Period-based) - Fetch and group in memory to avoid Prisma relation groupBy bugs
            this.prisma.paiement.findMany({
                where: {
                    ...paymentDateFilter,
                    facture: { centreId }
                },
                select: { mode: true, montant: true }
            })
        ]);

        const totalFactures = factureMetrics._sum.totalTTC || 0;
        const totalAvoirs = avoirMetrics._sum.totalTTC || 0;
        const totalBC = bcMetrics._sum.totalTTC || 0;

        // CA Global = Factures + BC - Avoirs (to match user expectation of "Chiffre d'Affaires Global")
        const totalAmount = totalFactures + totalBC - totalAvoirs;
        const totalReste = totalResteMetrics._sum.resteAPayer || 0;

        const paymentMap = new Map<string, number>();
        for (const p of (paymentAgg as { mode: string, montant: number }[])) {
            const m = p.mode || 'AUTRE';
            paymentMap.set(m, (paymentMap.get(m) || 0) + p.montant);
        }

        const payments = Array.from(paymentMap.entries()).map(([methode, total]) => ({
            methode,
            total
        }));
        const totalEncaissePeriod = payments.reduce((sum, p) => sum + p.total, 0);

        const stats = [{
            vendorId: 'all',
            vendorName: 'Tous les vendeurs',
            countValid: factureMetrics._count,
            countWithPayment: bcMetrics._count,
            countAvoir: avoirMetrics._count,
            totalAmount,
            totalFactures,
            totalAvoirs,
            totalBC,
            totalEncaissePeriod,
            totalReste,
            payments
        }];

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
                    raison: 'Déclaré comme don/offert'
                }
            }
        });
    }

    async archiveInvoice(id: string) {
        return this.prisma.facture.update({
            where: { id },
            data: { statut: 'ARCHIVE' }
        });
    }
}
