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
    async getBrouillonWithPayments(userId?: string, centreId?: string) {
        const where: any = {
            OR: [
                {
                    AND: [
                        {
                            OR: [
                                { numero: { startsWith: 'BRO' } },
                                { numero: { startsWith: 'Devis' } },
                                { numero: { startsWith: 'DEV' } },
                                { numero: { startsWith: 'BL' } }
                            ]
                        },
                        { paiements: { some: {} } }
                    ]
                },
                { statut: 'VENTE_EN_INSTANCE' }
            ],
            statut: { notIn: ['ARCHIVE', 'ANNULEE'] }
        };

        if (!centreId) return [];
        where.centreId = centreId;

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
    async getValidInvoices(userId?: string, centreId?: string) {
        const where: any = {
            numero: { startsWith: 'FAC' },
            statut: { not: 'VENTE_EN_INSTANCE' }
        };

        if (!centreId) return [];
        where.centreId = centreId;

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

    // Get AVOIRS and CANCELLED Drafts
    async getAvoirs(userId?: string, centreId?: string) {
        // Show real Avoirs
        const where: any = {
            type: 'AVOIR'
        };

        if (!centreId) return [];
        where.centreId = centreId;

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
                fiche: true,
                parentFacture: true
            },
            orderBy: {
                numero: 'desc'
            }
        });
    }

    // Get BROUILLON invoices without payments
    async getBrouillonWithoutPayments(userId?: string, centreId?: string) {
        const where: any = {
            OR: [
                { numero: { startsWith: 'BRO' } },
                { numero: { startsWith: 'Devis' } },
                { numero: { startsWith: 'DEV' } },
                { numero: { startsWith: 'BL' } }
            ],
            statut: { notIn: ['ARCHIVE', 'ANNULEE'] }, // Hide Archived and Cancelled
            paiements: {
                none: {}
            }
        };

        if (!centreId) return [];
        where.centreId = centreId;

        const results = await this.prisma.facture.findMany({
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

        console.log(`📡 [DEBUG] getBrouillonWithoutPayments: Found ${results.length} for center ${centreId}`);
        return results;
    }

    // Get statistics by vendor
    async getStatisticsByVendor(centreId?: string) {
        const where: any = {
            // Fetch all relevant types/statuses for stats
            OR: [
                { numero: { startsWith: 'BRO' } },
                { numero: { startsWith: 'Devis' } },
                { numero: { startsWith: 'DEV' } },
                { numero: { startsWith: 'BL' } },
                { numero: { startsWith: 'FAC' } },
                { type: 'AVOIR' }
            ]
        };

        if (!centreId) return [{
            vendorId: 'none',
            vendorName: 'Néant',
            countWithPayment: 0,
            countWithoutPayment: 0,
            countValid: 0,
            countAvoir: 0,
            countCancelled: 0,
            totalAmount: 0
        }];
        where.centreId = centreId;

        console.log(`📊 Statistics Query for Center: [${centreId || 'GLOBAL'}]`);
        const factures = await this.prisma.facture.findMany({
            where,
            include: {
                paiements: true,
                fiche: true
            }
        });

        console.log('📊 Statistics Query Result:', factures.length, 'factures found');

        // Simple statistics for now
        // Exclude ARCHIVE from "Devis" counts
        const withPayment = factures.filter(f =>
            ((f.numero.startsWith('BRO') || f.numero.startsWith('Devis') || f.numero.startsWith('DEV')) && f.paiements && f.paiements.length > 0 && f.statut !== 'ARCHIVE' && f.statut !== 'ANNULEE') ||
            (f.statut === 'VENTE_EN_INSTANCE')
        );
        const withoutPayment = factures.filter(f => (f.numero.startsWith('BRO') || f.numero.startsWith('Devis') || f.numero.startsWith('DEV')) && (!f.paiements || f.paiements.length === 0) && f.statut !== 'ARCHIVE' && f.statut !== 'ANNULEE' && f.statut !== 'VENTE_EN_INSTANCE');

        // Valid Invoices: Must have FAC prefix and not be cancelled, and NOT be in instance
        const validInvoices = factures.filter(f => f.numero.startsWith('FAC') && f.type === 'FACTURE' && f.statut !== 'ANNULEE' && f.statut !== 'VENTE_EN_INSTANCE');
        // Avoirs: Show all having type AVOIR
        const avoirs = factures.filter(f => f.type === 'AVOIR');
        // Cancelled Drafts (Traceability)
        const cancelledDrafts = factures.filter(f => f.statut === 'ANNULEE' && (f.numero.startsWith('BRO') || f.numero.startsWith('Devis')));

        // Valid Invoices + Avoirs for CA Calculation
        // Formula: sum(totalTTC) of all non-draft invoices, including those balanced by Avoirs
        const caRelevant = factures.filter(f =>
            (f.numero.startsWith('FAC') || f.type === 'AVOIR') &&
            f.statut !== 'ARCHIVE'
        );

        return [{
            vendorId: 'all',
            vendorName: 'Tous les vendeurs',
            countWithPayment: withPayment.length,
            countWithoutPayment: withoutPayment.length,
            countValid: validInvoices.length,
            countAvoir: avoirs.length,
            countCancelled: cancelledDrafts.length,
            totalAmount: caRelevant.reduce((sum, f) => sum + (f.totalTTC || 0), 0)
        }];
    }


    // Validate a BROUILLON invoice
    async validateInvoice(id: string) {
        // Use the existing update method which handles AVOIR creation
        return this.facturesService.update({
            where: { id },
            data: {
                statut: 'VALIDE',
                proprietes: {
                    forceStockDecrement: true
                }
            }
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

    // Consolidated dashboard data
    async getDashboardData(userId?: string, centreId?: string) {
        console.log(`📡 [DASHBOARD-SYNC] Fetching starting for centreId: ${centreId || 'all'}, userId: ${userId || 'all'}`);
        const start = Date.now();

        try {
            const [
                withPayments,
                withoutPayments,
                valid,
                avoirs,
                stats
            ] = await Promise.all([
                this.getBrouillonWithPayments(userId, centreId),
                this.getBrouillonWithoutPayments(userId, centreId),
                this.getValidInvoices(userId, centreId),
                this.getAvoirs(userId, centreId),
                this.getStatisticsByVendor(centreId)
            ]);

            const duration = Date.now() - start;
            console.log(`✅ [DASHBOARD-SYNC] Data fetched successfully in ${duration}ms for center ${centreId}`);

            return {
                withPayments,
                withoutPayments,
                valid,
                avoirs,
                stats
            };
        } catch (error) {
            console.error(`❌ [DASHBOARD-SYNC] Error fetching data for center ${centreId}:`, error);
            throw error;
        }
    }
}
