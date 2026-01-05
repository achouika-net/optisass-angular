import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';

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
            const product = await this.prisma.product.findUnique({
                where: { id: line.productId }
            });

            if (!product) continue;

            // Find matching rule
            const rule = rules.find(r => r.typeProduit === product.typeArticle) ||
                rules.find(r => r.typeProduit === 'GLOBAL');

            if (rule) {
                const montantCom = (line.totalTTC || 0) * (rule.taux / 100);
                if (montantCom > 0) {
                    const com = await this.prisma.commission.create({
                        data: {
                            employeeId: employee.id,
                            factureId: facture.id,
                            type: product.typeArticle,
                            montant: montantCom,
                            mois: mois
                        }
                    });
                    results.push(com);
                }
            }
        }

        return results;
    }

    async getEmployeeCommissions(employeeId: string, mois: string) {
        return this.prisma.commission.findMany({
            where: { employeeId, mois },
            include: { facture: { select: { numero: true, totalTTC: true } } }
        });
    }

    async getTotalCommissions(employeeId: string, mois: string) {
        const aggregations = await this.prisma.commission.aggregate({
            where: { employeeId, mois },
            _sum: { montant: true }
        });
        return aggregations._sum.montant || 0;
    }
}
