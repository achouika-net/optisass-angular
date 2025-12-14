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
            statut: 'BROUILLON',
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

    // Get BROUILLON invoices without payments
    async getBrouillonWithoutPayments(userId?: string) {
        const where: any = {
            statut: 'BROUILLON',
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
                statut: 'BROUILLON'
            },
            include: {
                paiements: true,
                fiche: true
            }
        });

        // Simple statistics for now
        const withPayment = factures.filter(f => f.paiements && f.paiements.length > 0);
        const withoutPayment = factures.filter(f => !f.paiements || f.paiements.length === 0);
        
        return [{
            vendorId: 'all',
            vendorName: 'Tous les vendeurs',
            countWithPayment: withPayment.length,
            countWithoutPayment: withoutPayment.length,
            totalAmount: factures.reduce((sum, f) => sum + f.totalTTC, 0)
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
