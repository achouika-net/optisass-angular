import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FacturesService } from '../factures/factures.service';

@Injectable()
export class SalesControlService {
    constructor(
        private prisma: PrismaService,
        private facturesService: FacturesService
    ) { }

    // Get BROUILLON invoices with payments
    async getBrouillonWithPayments(userId?: string) {
        const where: any = {
            numero: { startsWith: 'BRO' },
            paiements: {
                some: {}
            }
        };

        // Note: Vendor filtering would require adding createdBy field to Fiche schema
        // For now, return all BROUILLON with payments

        return this.prisma.facture.findMany({
            where,
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
    }

    // Get VALID invoices (Valid, Payee, Partiel)
    async getValidInvoices(userId?: string) {
        const where: any = {
            numero: { startsWith: 'FAC' }
            // Removed strict type check to ensure any FAC numbered invoice appears
        };

        return this.prisma.facture.findMany({
            where,
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
                numero: 'desc'
            }
        });
    }

    // Get AVOIRS and CANCELLED Drafts
    async getAvoirs(userId?: string) {
        const where: any = {
            OR: [
                { type: 'AVOIR' },
                { statut: 'ANNULEE' }
            ]
        };

        return this.prisma.facture.findMany({
            where,
            include: {
                client: {
                    select: {
                        nom: true,
                        prenom: true,
                        raisonSociale: true
                    }
                },
                paiements: true
            },
            orderBy: {
                numero: 'desc'
            }
        });
    }

    // Get BROUILLON invoices without payments
    async getBrouillonWithoutPayments(userId?: string) {
        const where: any = {
            numero: { startsWith: 'BRO' },
            statut: { not: 'ANNULEE' },
            paiements: {
                none: {}
            }
        };

        return this.prisma.facture.findMany({
            where,
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
    }

    // Get statistics by vendor
    async getStatisticsByVendor() {
        const factures = await this.prisma.facture.findMany({
            where: {
                // Fetch all relevant types/statuses for stats
                OR: [
                    { numero: { startsWith: 'BRO' } },
                    { numero: { startsWith: 'FAC' } },
                    { type: 'AVOIR' }
                ]
            },
            include: {
                paiements: true,
                fiche: true
            }
        });

        console.log('📊 Statistics Query Result:', factures.length, 'factures found');
        console.log('📊 Status Distribution:', factures.map(f => `${f.numero}:${f.statut}:${f.type}`));

        // Simple statistics for now
        const withPayment = factures.filter(f => f.numero.startsWith('BRO') && f.paiements && f.paiements.length > 0);
        const withoutPayment = factures.filter(f => f.numero.startsWith('BRO') && (!f.paiements || f.paiements.length === 0) && f.statut !== 'ANNULEE');

        // Valid Invoices: Must have FAC prefix
        const validInvoices = factures.filter(f => f.numero.startsWith('FAC') && f.type === 'FACTURE');

        // Avoirs
        const avoirs = factures.filter(f => f.type === 'AVOIR');

        // Cancelled Drafts (Traceability)
        const cancelledDrafts = factures.filter(f => f.statut === 'ANNULEE' && f.numero.startsWith('BRO'));

        return [{
            vendorId: 'all',
            vendorName: 'Tous les vendeurs',
            countWithPayment: withPayment.length,
            countWithoutPayment: withoutPayment.length,
            countValid: validInvoices.length,
            countAvoir: avoirs.length,
            countCancelled: cancelledDrafts.length, // Unmapped in UI yet, but useful for debug
            totalAmount: validInvoices.reduce((sum, f) => sum + f.totalTTC, 0) // Only sum VALID invoices revenue
        }];
    }

    // Validate a BROUILLON invoice
    async validateInvoice(id: string) {
        // Use the existing update method which handles AVOIR creation
        return this.facturesService.update({
            where: { id },
            data: { statut: 'VALIDE' }
        });
    }

    // Declare as gift (create 0 DH invoice)
    async declareAsGift(id: string) {
        const facture = await this.prisma.facture.findUnique({
            where: { id },
            include: { client: true }
        });

        if (!facture) {
            throw new Error('Facture not found');
        }

        // Update to 0 DH and mark as gift
        return this.prisma.facture.update({
            where: { id },
            data: {
                totalHT: 0,
                totalTVA: 0,
                totalTTC: 0,
                resteAPayer: 0,
                statut: 'VALIDE',
                proprietes: {
                    ...facture.proprietes as any,
                    typeVente: 'DON',
                    raison: 'Déclaré comme don/offert'
                }
            }
        });
    }
}
