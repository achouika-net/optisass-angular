import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { ProductsService } from '../products/products.service';
import { normalizeToUTCNoon } from '../../shared/utils/date-utils';

@Injectable()
export class SupplierInvoicesService {
    constructor(
        private prisma: PrismaService,
        private productsService: ProductsService
    ) { }

    async create(createDto: CreateSupplierInvoiceDto) {
        const { echeances, ...invoiceData } = createDto;

        // Robust duplicate check
        const existingInvoice = await this.checkExistence(invoiceData.fournisseurId, invoiceData.numeroFacture);

        if (existingInvoice) {
            console.log(`[INVOICE] Update existing invoice ${existingInvoice.numeroFacture} for supplier ${invoiceData.fournisseurId}`);
            return this.update(existingInvoice.id, createDto);
        }

        const status = this.calculateInvoiceStatus(invoiceData.montantTTC, echeances || []);

        // Si aucune échéance n'est fournie (ex: BL simple), on en crée une par défaut pour le total
        const finalEcheances = (echeances && echeances.length > 0) ? echeances : [
            {
                type: 'ESPECES',
                dateEcheance: normalizeToUTCNoon(invoiceData.dateEcheance || new Date()) as Date,
                montant: invoiceData.montantTTC,
                statut: 'EN_ATTENTE'
            }
        ];

        return this.prisma.factureFournisseur.create({
            data: {
                ...invoiceData,
                dateEmission: normalizeToUTCNoon(invoiceData.dateEmission) as Date,
                dateEcheance: normalizeToUTCNoon(invoiceData.dateEcheance),
                statut: status,
                centreId: invoiceData.centreId, // Explicitly map it
                echeances: {
                    create: finalEcheances.map(e => ({
                        ...e,
                        dateEcheance: normalizeToUTCNoon(e.dateEcheance) as Date
                    }))
                }
            },
            include: {
                echeances: true,
                fournisseur: true
            }
        });
    }

    async findAll(fournisseurId?: string, statut?: string, clientId?: string, centreId?: string) {
        const whereClause: any = {};
        if (fournisseurId) whereClause.fournisseurId = fournisseurId;
        if (statut) whereClause.statut = statut;
        if (clientId) whereClause.clientId = clientId;
        if (centreId) whereClause.centreId = centreId;

        return this.prisma.factureFournisseur.findMany({
            where: whereClause,
            include: {
                fournisseur: true,
                echeances: true,
                client: true
            },
            orderBy: { dateEmission: 'desc' }
        });
    }

    async findOne(id: string) {
        return this.prisma.factureFournisseur.findUnique({
            where: { id },
            include: {
                fournisseur: true,
                echeances: true,
                depenses: true,
                client: true
            }
        });
    }

    async checkExistence(fournisseurId: string, numeroFacture: string) {
        if (!fournisseurId || !numeroFacture) return null;
        const trimmedNumero = numeroFacture.trim();
        return this.prisma.factureFournisseur.findFirst({
            where: {
                fournisseurId: fournisseurId,
                numeroFacture: {
                    equals: trimmedNumero,
                    mode: 'insensitive'
                }
            },
            include: {
                echeances: true,
                fournisseur: true
            }
        });
    }

    async update(id: string, updateDto: any) {
        const { echeances, ...invoiceData } = updateDto;

        // Clean invoiceData to remove unwanted circular or extra relation objects
        const cleanedInvoiceData: any = {
            numeroFacture: invoiceData.numeroFacture,
            dateEmission: normalizeToUTCNoon(invoiceData.dateEmission),
            dateEcheance: normalizeToUTCNoon(invoiceData.dateEcheance),
            montantHT: invoiceData.montantHT,
            montantTVA: invoiceData.montantTVA,
            montantTTC: invoiceData.montantTTC,
            statut: invoiceData.statut,
            type: invoiceData.type,
            pieceJointeUrl: invoiceData.pieceJointeUrl,
            fournisseurId: invoiceData.fournisseurId,
            centreId: invoiceData.centreId,
            clientId: invoiceData.clientId,
        };

        return this.prisma.$transaction(async (tx) => {
            if (echeances) {
                // Pour simplifier, on supprime les anciennes échéances et on recrée
                await tx.echeancePaiement.deleteMany({
                    where: { factureFournisseurId: id }
                });
            }

            const status = this.calculateInvoiceStatus(cleanedInvoiceData.montantTTC || 0, echeances || []);
            cleanedInvoiceData.statut = status;

            return tx.factureFournisseur.update({
                where: { id },
                data: {
                    ...cleanedInvoiceData,
                    echeances: echeances ? {
                        create: echeances.map((e: any) => ({
                            type: e.type,
                            dateEcheance: normalizeToUTCNoon(e.dateEcheance) as Date,
                            dateEncaissement: normalizeToUTCNoon(e.dateEncaissement),
                            montant: e.montant,
                            statut: e.statut,
                            reference: e.reference || null,
                            banque: e.banque || null,
                            remarque: e.remarque || null
                        }))
                    } : undefined
                },
                include: {
                    echeances: true
                }
            });
        });
    }

    private calculateInvoiceStatus(totalTTC: number, echeances: any[]): string {
        if (!echeances || echeances.length === 0) return 'EN_ATTENTE';

        // Filter out cancelled ones
        const activeEcheances = echeances.filter(e => e.statut !== 'ANNULE');
        if (activeEcheances.length === 0) return 'EN_ATTENTE';

        const totalPaid = Math.round(activeEcheances
            .filter(e => e.statut === 'ENCAISSE')
            .reduce((sum, e) => sum + (e.montant || 0), 0) * 100) / 100;

        const roundedTotalTTC = Math.round(totalTTC * 100) / 100;

        if (totalPaid >= roundedTotalTTC && roundedTotalTTC > 0) {
            return 'PAYEE';
        }

        if (totalPaid > 0) return 'PARTIELLE';

        const hasScheduled = activeEcheances.some(e => e.type !== 'ESPECES' && e.statut === 'EN_ATTENTE');
        return hasScheduled ? 'PARTIELLE' : 'EN_ATTENTE';
    }

    async remove(id: string) {
        return this.prisma.$transaction(async (tx) => {
            const invoice = await tx.factureFournisseur.findUnique({
                where: { id },
                include: { mouvementsStock: true }
            });

            if (!invoice) return null;

            // 0. Get affected product IDs before deletion
            const productIds = Array.from(new Set(invoice.mouvementsStock.map(m => m.produitId)));

            // 1. Clear Movements (This triggers the sync later)
            await tx.mouvementStock.deleteMany({
                where: { factureFournisseurId: id }
            });

            // 2. Sync each affected product
            for (const productId of productIds) {
                await this.productsService.syncProductState(productId, tx);
            }

            // 3. Delete linked Expense if exists
            await tx.depense.deleteMany({
                where: { factureFournisseurId: id }
            });

            // 4. Delete payment schedules
            await tx.echeancePaiement.deleteMany({
                where: { factureFournisseurId: id }
            });

            // 5. Delete the Invoice itself
            return tx.factureFournisseur.delete({
                where: { id }
            });
        });
    }

    async getSupplierSituation(fournisseurId: string) {
        const invoices = await this.prisma.factureFournisseur.findMany({
            where: {
                fournisseurId: fournisseurId,
                statut: { not: 'ANNULEE' }
            },
            include: {
                echeances: true
            }
        });

        let totalTTC = 0;
        let totalPaye = 0;

        for (const invoice of invoices) {
            totalTTC += invoice.montantTTC;

            // Calculate paid amount from echeances
            if (invoice.echeances) {
                const paidEcheances = invoice.echeances.filter(e => e.statut === 'ENCAISSE');
                const paidAmount = paidEcheances.reduce((sum, e) => sum + e.montant, 0);
                totalPaye += paidAmount;
            }

            // If invoices are marked PAYEE manually but no echeances? 
            // We assume echeances are the source of truth for payment, 
            // but if status is PAYEE and paidAmount is 0, maybe we should count full amount? 
            // Let's stick to echeances for accuracy, or if status is PAYEE assume full if no echeances exist?
            // For now, let's rely on echeances for calculation.
        }

        return {
            fournisseurId,
            totalTTC,
            totalPaye,
            resteAPayer: totalTTC - totalPaye,
            invoiceCount: invoices.length
        };
    }
}

