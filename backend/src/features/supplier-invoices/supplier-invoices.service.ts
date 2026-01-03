import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';

@Injectable()
export class SupplierInvoicesService {
    constructor(private prisma: PrismaService) { }

    async create(createDto: CreateSupplierInvoiceDto) {
        const { echeances, ...invoiceData } = createDto;

        const status = this.calculateInvoiceStatus(invoiceData.montantTTC, echeances || []);

        return this.prisma.factureFournisseur.create({
            data: {
                ...invoiceData,
                statut: status,
                centreId: invoiceData.centreId, // Explicitly map it
                echeances: echeances ? {
                    create: echeances
                } : undefined
            },
            include: {
                echeances: true,
                fournisseur: true
            }
        });
    }

    async findAll(fournisseurId?: string, statut?: string, clientId?: string) {
        const whereClause: any = {};
        if (fournisseurId) whereClause.fournisseurId = fournisseurId;
        if (statut) whereClause.statut = statut;
        if (clientId) whereClause.clientId = clientId;

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

        const totalPaid = activeEcheances
            .filter(e => e.statut === 'ENCAISSE')
            .reduce((sum, e) => sum + (e.montant || 0), 0);

        if (totalPaid >= totalTTC && totalTTC > 0) {
            return 'PAYEE';
        }

        // Even if not yet 'ENCAISSE', if there are payments, it's not 'EN_ATTENTE'
        // If they cover the total, it's a good sign, we can call it 'PARTIELLE'
        // effectively acknowledging the payment is recorded/scheduled.
        return 'PARTIELLE';
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

