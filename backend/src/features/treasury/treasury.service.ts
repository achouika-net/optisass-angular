import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TreasuryService {
    constructor(private prisma: PrismaService) { }

    async getMonthlySummary(year: number, month: number, centreId?: string) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // 1. Dépenses directes (Espèces/CB) du mois
        const expenses = await this.prisma.depense.aggregate({
            where: {
                date: { gte: startDate, lte: endDate },
                centreId: centreId,
                modePaiement: { in: ['ESPECES', 'CARTE'] }
            },
            _sum: { montant: true }
        });

        // 2. Échéances (Chèques/LCN) à encaisser/décaisser ce mois
        const echeances = await this.prisma.echeancePaiement.aggregate({
            where: {
                dateEcheance: { gte: startDate, lte: endDate },
                statut: { not: 'ANNULE' }
            },
            _sum: { montant: true }
        });

        // 3. Répartition par catégorie (Dépenses)
        const categoryStats = await this.prisma.depense.groupBy({
            by: ['categorie'],
            where: {
                date: { gte: startDate, lte: endDate },
                centreId: centreId
            },
            _sum: { montant: true }
        });

        return {
            month,
            year,
            totalDirectExpenses: expenses._sum.montant || 0,
            totalEcheances: echeances._sum.montant || 0,
            totalProjected: (expenses._sum.montant || 0) + (echeances._sum.montant || 0),
            categories: categoryStats.map(c => ({
                name: c.categorie,
                value: c._sum.montant || 0
            }))
        };
    }

    async getYearlyProjection(year: number) {
        // Pour un graphique d'évolution sur l'année
        const stats: any[] = [];
        for (let m = 1; m <= 12; m++) {
            const s = await this.getMonthlySummary(year, m);
            stats.push(s);
        }
        return stats;
    }
}
