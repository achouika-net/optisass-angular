import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';

@Injectable()
export class CommissionService {
    constructor(private prisma: PrismaService) { }

    async createRule(dto: CreateCommissionRuleDto) {
        return this.prisma.commissionRule.create({ data: dto });
    }

    async getRules(centreId?: string) {
        return this.prisma.commissionRule.findMany({
            where: centreId ? { centreId } : {}
        });
    }

    async updateRule(id: string, dto: UpdateCommissionRuleDto) {
        return this.prisma.commissionRule.update({
            where: { id },
            data: dto
        });
    }

    async deleteRule(id: string) {
        return this.prisma.commissionRule.delete({
            where: { id }
        });
    }

    /**
     * Calculates commissions for a specific invoice.
     * Should be called when an invoice is VALIDATED and PAID.
     */
    async calculateForInvoice(factureId: string) {
        const facture = await this.prisma.facture.findUnique({
            where: { id: factureId },
            include: { vendeur: true }
        });

        if (!facture || !facture.vendeurId || !facture.vendeur) return null;

        const employee = facture.vendeur;
        const mois = facture.dateEmission.toISOString().substring(0, 7); // YYYY-MM

        // Delete existing commissions for this invoice to avoid doubles (Idempotency)
        await this.prisma.commission.deleteMany({
            where: { factureId: facture.id }
        });

        // Get rules for this employee's poste and centre
        const rules = await this.prisma.commissionRule.findMany({
            where: {
                poste: employee.poste,
                OR: [
                    { centreId: facture.centreId },
                    { centreId: null }
                ]
            }
        });

        const lines = typeof facture.lignes === 'string' ? JSON.parse(facture.lignes) : (facture.lignes as any[]);
        if (!Array.isArray(lines)) return null;

        const results: any[] = [];

        for (const line of lines) {
            let typeArticle: string | null = null;

            if (line.productId) {
                const product = await this.prisma.product.findUnique({
                    where: { id: line.productId }
                });
                if (product) {
                    typeArticle = product.typeArticle;
                }
            }

            // Fallback: If no product found or custom line, infer from description
            if (!typeArticle && line.description) {
                const desc = line.description.toUpperCase();
                if (desc.includes('MONTURE')) typeArticle = 'MONTURE';
                else if (desc.includes('VERRE')) typeArticle = 'VERRE';
                else if (desc.includes('LENTILLE')) typeArticle = 'LENTILLE';
                else if (desc.includes('ACCESSOIRE')) typeArticle = 'ACCESSOIRE';
            }

            // Find matching rule (Flexible matching: exactly matches OR product type starts with rule type)
            // e.g. Rule 'MONTURE' matches product 'MONTURE_OPTIQUE'
            const rule = rules.find(r => {
                if (!typeArticle) return false;
                const rType = r.typeProduit.toUpperCase();
                const pType = typeArticle.toUpperCase();
                return rType === pType || pType.startsWith(rType + '_');
            }) || rules.find(r => r.typeProduit === 'GLOBAL');

            if (rule) {
                const montantCom = (line.totalTTC || 0) * (rule.taux / 100);
                if (montantCom > 0) {
                    await this.prisma.commission.create({
                        data: {
                            employeeId: employee.id,
                            factureId: facture.id,
                            type: typeArticle || 'INCONNU',
                            montant: montantCom,
                            mois: mois
                        }
                    });
                    results.push({ type: typeArticle, montant: montantCom });
                }
            }
        }

        return results;
    }

    async getEmployeeCommissions(employeeId: string, mois: string, annee?: number) {
        const fullMois = annee ? `${annee}-${mois}` : mois;
        return this.prisma.commission.findMany({
            where: { employeeId, mois: fullMois },
            include: {
                facture: {
                    select: {
                        numero: true,
                        totalTTC: true,
                        dateEmission: true
                    }
                }
            }
        });
    }

    async getTotalCommissions(employeeId: string, mois: string, annee?: number) {
        const fullMois = annee ? `${annee}-${mois}` : mois;
        const aggregations = await this.prisma.commission.aggregate({
            where: { employeeId, mois: fullMois },
            _sum: { montant: true }
        });
        return aggregations._sum.montant || 0;
    }

    /**
     * Recalculates all commissions for a given month.
     * Useful for recovering missing commissions after linking users to employees.
     */
    async recalculateForPeriod(mois: string) {
        // Find all validated/paid invoices for this month
        const factures = await this.prisma.facture.findMany({
            where: {
                statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] },
                dateEmission: {
                    gte: new Date(`${mois}-01`),
                    lt: new Date(new Date(`${mois}-01`).setMonth(new Date(`${mois}-01`).getMonth() + 1))
                }
            }
        });

        console.log(`🔄 [CommissionService] Recalculating for ${factures.length} invoices in ${mois}`);

        let totalCreated = 0;

        for (const facture of factures) {
            // Delete existing commissions for this invoice to avoid doubles
            await this.prisma.commission.deleteMany({
                where: { factureId: facture.id }
            });

            // Calculate new ones
            const results = await this.calculateForInvoice(facture.id);
            if (results && results.length > 0) {
                totalCreated += results.length;
            }
        }

        return {
            invoicesProcessed: factures.length,
            commissionsCreated: totalCreated
        };
    }
}
