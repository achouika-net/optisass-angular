import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FacturesService } from '../factures/factures.service';

@Injectable()
export class SalesControlService {

    constructor(
        private prisma: PrismaService,
        private facturesService: FacturesService
    ) { }

    // Get items for Tab 1: Vente en instance (BCs, Documents with Payments, or Instance status)
    async getBrouillonWithPayments(userId?: string, centreId?: string) {
        if (!centreId) return [];

        const results = await this.prisma.facture.findMany({
            where: {
                centreId,
                statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
                type: { not: 'AVOIR' }
            },
            include: {
                client: {
                    select: {
                        nom: true,
                        prenom: true,
                        raisonSociale: true
                    }
                },
                paiements: true,
                fiche: true
            },
            orderBy: {
                dateEmission: 'desc'
            }
        });

        // RE-FILTER: Strictly include only confirmed sales or drafts with money
        return results.filter(f => {
            // Priority 1: Specifically marked as Instance
            if (f.statut === 'VENTE_EN_INSTANCE') return true;

            // Priority 2: Established BCs (even without payments yet)
            if (f.type === 'BON_COMM' || f.numero.startsWith('BC')) return true;

            // Priority 3: Drafts with payments (that are not final invoices)
            const hasPayments = f.paiements && f.paiements.length > 0;
            const isNotFinal = !f.numero.startsWith('FAC');
            if (hasPayments && isNotFinal) return true;

            return false;
        });
    }

    // Get items for Tab 2: Devis (Prospects, Drafts with NO payments and NOT BCs)
    async getBrouillonWithoutPayments(userId?: string, centreId?: string) {
        if (!centreId) return [];

        const results = await this.prisma.facture.findMany({
            where: {
                centreId,
                statut: { notIn: ['ARCHIVE', 'ANNULEE', 'VENTE_EN_INSTANCE'] },
                paiements: {
                    none: {}
                }
            },
            include: {
                client: {
                    select: {
                        nom: true,
                        prenom: true,
                        raisonSociale: true
                    }
                },
                fiche: true
            },
            orderBy: {
                dateEmission: 'desc'
            }
        });

        // RE-FILTER: Strictly include only real prospects/devis
        return results.filter(f => {
            // EXCLUDE: Already promoted to BC or Instance
            if (f.type === 'BON_COMM' || f.numero.startsWith('BC')) return false;
            if (f.statut === 'VENTE_EN_INSTANCE') return false;

            // INCLUDE: Real Devis/Drafts
            const num = (f.numero || '').toUpperCase();
            const isDevis = f.type === 'DEVIS' || num.startsWith('BRO') || num.startsWith('DEV') || num.startsWith('DEVIS');

            return isDevis;
        });
    }

    // Tab 3: VALID invoices (Official FAC- Documents)
    async getValidInvoices(userId?: string, centreId?: string) {
        if (!centreId) return [];

        return this.prisma.facture.findMany({
            where: {
                centreId,
                numero: { startsWith: 'FAC' },
                statut: { not: 'VENTE_EN_INSTANCE' }
            },
            include: {
                client: {
                    select: {
                        nom: true,
                        prenom: true,
                        raisonSociale: true
                    }
                },
                paiements: true,
                fiche: true,
                children: {
                    select: {
                        id: true,
                        numero: true,
                        type: true,
                        statut: true
                    }
                }
            },
            orderBy: {
                numero: 'desc'
            }
        });
    }

    // Tab 4: AVOIRS 
    async getAvoirs(userId?: string, centreId?: string) {
        if (!centreId) return [];

        return this.prisma.facture.findMany({
            where: {
                centreId,
                type: 'AVOIR'
            },
            include: {
                client: {
                    select: {
                        nom: true,
                        prenom: true,
                        raisonSociale: true
                    }
                },
                paiements: true,
                fiche: true,
                parentFacture: true
            },
            orderBy: {
                numero: 'desc'
            }
        });
    }

    // Tab: Statistics
    async getStatisticsByVendor(centreId?: string) {
        if (!centreId) return [{
            vendorId: 'all',
            vendorName: 'Tous les vendeurs',
            countWithPayment: 0,
            countWithoutPayment: 0,
            countValid: 0,
            countAvoir: 0,
            countCancelled: 0,
            totalAmount: 0
        }];

        const factures = await this.prisma.facture.findMany({
            where: { centreId },
            include: { paiements: true }
        });

        const inInstance = factures.filter(f => {
            if (f.statut === 'VENTE_EN_INSTANCE') return true;
            if (f.type === 'BON_COMM' || f.numero.startsWith('BC')) return true;
            return f.paiements && f.paiements.length > 0 && !f.numero.startsWith('FAC') && f.statut !== 'ARCHIVE' && f.statut !== 'ANNULEE';
        });

        const isDevis = factures.filter(f => {
            if (f.type === 'BON_COMM' || f.numero.startsWith('BC')) return false;
            if (f.statut === 'VENTE_EN_INSTANCE') return false;
            if (f.paiements && f.paiements.length > 0) return false;
            const num = (f.numero || '').toUpperCase();
            return (f.type === 'DEVIS' || num.startsWith('BRO') || num.startsWith('DEV')) && f.statut !== 'ARCHIVE' && f.statut !== 'ANNULEE';
        });

        const validInvoices = factures.filter(f => f.numero.startsWith('FAC') && f.type === 'FACTURE' && f.statut !== 'ANNULEE');
        const avoirs = factures.filter(f => f.type === 'AVOIR');
        const cancelledDrafts = factures.filter(f => f.statut === 'ANNULEE' && (f.numero.startsWith('BRO') || (f.numero || '').startsWith('Devis')));

        const caRelevant = factures.filter(f => (f.numero.startsWith('FAC') || f.type === 'AVOIR') && f.statut !== 'ARCHIVE');

        return [{
            vendorId: 'all',
            vendorName: 'Tous les vendeurs',
            countWithPayment: inInstance.length,
            countWithoutPayment: isDevis.length,
            countValid: validInvoices.length,
            countAvoir: avoirs.length,
            countCancelled: cancelledDrafts.length,
            totalAmount: caRelevant.reduce((sum, f) => sum + (f.totalTTC || 0), 0)
        }];
    }

    // Validate invoice - handles both DEVIS→BC and BC→FACTURE transitions
    async validateInvoice(id: string) {
        const currentDoc = await this.prisma.facture.findUnique({ where: { id } });
        if (!currentDoc) throw new Error(`Document ${id} not found`);

        if (currentDoc.type === 'BON_COMM') {
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
                type: 'BON_COMM' as any,
                statut: 'VENTE_EN_INSTANCE',
                proprietes: { forceStockDecrement: true }
            }
        });
    }

    // Consolidated dashboard data
    async getDashboardData(userId?: string, centreId?: string) {
        const [withPayments, withoutPayments, valid, avoirs, stats] = await Promise.all([
            this.getBrouillonWithPayments(userId, centreId),
            this.getBrouillonWithoutPayments(userId, centreId),
            this.getValidInvoices(userId, centreId),
            this.getAvoirs(userId, centreId),
            this.getStatisticsByVendor(centreId)
        ]);

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
