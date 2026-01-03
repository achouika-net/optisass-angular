import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';

@Injectable()
export class SupplierInvoicesService {
    constructor(private prisma: PrismaService) { }

    async create(createDto: CreateSupplierInvoiceDto) {
        const { echeances, ...invoiceData } = createDto;

        const status = this.calculateInvoiceStatus(invoiceData.montantTTC, echeances || []);

        // Si aucune échéance n'est fournie (ex: BL simple), on en crée une par défaut pour le total
        const finalEcheances = (echeances && echeances.length > 0) ? echeances : [
            {
                type: 'ESPECES',
                dateEcheance: invoiceData.dateEcheance || new Date().toISOString(),
                montant: invoiceData.montantTTC,
                statut: 'EN_ATTENTE'
            }
        ];

        return this.prisma.factureFournisseur.create({
            data: {
                ...invoiceData,
                statut: status,
                centreId: invoiceData.centreId, // Explicitly map it
                echeances: {
                    create: finalEcheances
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

    async update(id: string, updateDto: any) {
        const { echeances, ...invoiceData } = updateDto;

        return this.prisma.$transaction(async (tx) => {
            if (echeances) {
                // Pour simplifier, on supprime les anciennes échéances et on recrée
                await tx.echeancePaiement.deleteMany({
                    where: { factureFournisseurId: id }
                });
            }

            const status = this.calculateInvoiceStatus(invoiceData.montantTTC || 0, echeances || []);

            return tx.factureFournisseur.update({
                where: { id },
                data: {
                    ...invoiceData,
                    statut: status,
                    echeances: echeances ? {
                        create: echeances
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
        return this.prisma.factureFournisseur.delete({
            where: { id },
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

