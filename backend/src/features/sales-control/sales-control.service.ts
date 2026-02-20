import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FacturesService } from '../factures/factures.service';

@Injectable()
export class SalesControlService {

    constructor(
        private prisma: PrismaService,
        private facturesService: FacturesService
    ) { }

    // Tab 1: Bons de Commande (BCs, Documents with Payments, or Instance status)
    async getBrouillonWithPayments(userId?: string, centreId?: string, startDate?: string, endDate?: string) {
        if (!centreId) return [];
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        const results = await this.prisma.facture.findMany({
            where: {
                centreId,
                statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
                ...(start || end ? { dateEmission: { gte: start, lte: end } } : {})
            },
            include: {
                client: { select: { nom: true, prenom: true, raisonSociale: true } },
                paiements: true,
                fiche: true
            },
            orderBy: { dateEmission: 'desc' }
        });

        return results.filter(f => {
            if (f.statut === 'ANNULEE' || f.type === 'AVOIR') return false;
            // Valide Factures are handled in Tab 3
            if ((f.numero || '').startsWith('FAC') || f.type === 'FACTURE') {
                if (f.statut !== 'VENTE_EN_INSTANCE') return false;
            }

            if (f.statut === 'VENTE_EN_INSTANCE') return true;
            const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM' || (f.numero || '').startsWith('BC');
            if (isBC) return true;
            const hasPayments = f.paiements && f.paiements.length > 0;
            return hasPayments;
        });
    }

    // Tab 2: Devis
    async getBrouillonWithoutPayments(userId?: string, centreId?: string, startDate?: string, endDate?: string) {
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
            orderBy: { dateEmission: 'desc' }
        });

        return results.filter(f => {
            const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM' || (f.numero || '').startsWith('BC');
            if (isBC) return false;
            const num = (f.numero || '').toUpperCase();
            return f.type === 'DEVIS' || num.startsWith('BRO') || num.startsWith('DEV') || num.startsWith('DEVIS');
        });
    }

    // Tab 3: Valid Invoices (Official FAC- Documents)
    async getValidInvoices(userId?: string, centreId?: string, startDate?: string, endDate?: string) {
        if (!centreId) return [];
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.prisma.facture.findMany({
            where: {
                centreId,
                OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
                statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
                type: { not: 'AVOIR' },
                ...(start || end ? { dateEmission: { gte: start, lte: end } } : {})
            },
            include: {
                client: { select: { nom: true, prenom: true, raisonSociale: true } },
                paiements: true,
                fiche: true,
                children: { select: { id: true, numero: true, type: true, statut: true } }
            },
            orderBy: { numero: 'desc' }
        });
    }

    // Tab 4: AVOIRS 
    async getAvoirs(userId?: string, centreId?: string, startDate?: string, endDate?: string) {
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
            orderBy: { numero: 'desc' }
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

    // Consolidated dashboard data
    async getDashboardData(userId?: string, centreId?: string, startDate?: string, endDate?: string) {
        if (!centreId) return { withPayments: [], withoutPayments: [], valid: [], avoirs: [], stats: [] };

        const [withPayments, withoutPayments, valid, avoirs] = await Promise.all([
            this.getBrouillonWithPayments(userId, centreId, startDate, endDate),
            this.getBrouillonWithoutPayments(userId, centreId, startDate, endDate),
            this.getValidInvoices(userId, centreId, startDate, endDate),
            this.getAvoirs(userId, centreId, startDate, endDate)
        ]);

        // Detailed Totals for Breakdown
        const totalFactures = valid.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
        const totalAvoirs = avoirs.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
        const totalBC = withPayments.reduce((sum, f) => sum + (f.totalTTC || 0), 0);

        // Final CA: Invoices - Avoirs
        const totalAmount = totalFactures - totalAvoirs;

        const stats = [{
            vendorId: 'all',
            vendorName: 'Tous les vendeurs',
            countWithPayment: withPayments.length,
            countWithoutPayment: withoutPayments.length,
            countValid: valid.length,
            countAvoir: avoirs.length,
            countCancelled: 0,
            totalAmount,
            totalFactures,
            totalAvoirs,
            totalBC
        }];

        return { withPayments, withoutPayments, valid, avoirs, stats };
    }

    async declareAsGift(id: string) {
        const facture = await this.prisma.facture.findUnique({ where: { id } });
        if (!facture) throw new Error('Facture not found');

        return this.prisma.facture.update({
            where: { id },
            data: {
                totalHT: 0, totalTVA: 0, totalTTC: 0, resteAPayer: 0,
                statut: 'VALIDE',
                proprietes: {
                    ...facture.proprietes as any,
                    typeVente: 'DON', raison: 'Déclaré comme don/offert'
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
