import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TreasuryService {
    constructor(private prisma: PrismaService) { }

    async getMonthlySummary(year: number, month: number, centreId?: string) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const [expenses, echeances, incoming, incomingCashed, echeancesCashed, incomingPending, echeancesPending, categoryStats, invoiceCategoryStats, config] = await Promise.all([
            // Outgoings (Direct Expenses: Cash/Card)
            this.prisma.depense.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                    centreId: centreId,
                    modePaiement: { in: ['ESPECES', 'CARTE'] }
                },
                _sum: { montant: true }
            }),
            // Outgoings (Total Scheduled: Checks/LCN regardless of status)
            this.prisma.echeancePaiement.aggregate({
                where: {
                    dateEcheance: { gte: startDate, lte: endDate },
                    statut: { not: 'ANNULE' },
                    ...(centreId ? {
                        OR: [
                            { depense: { centreId } },
                            { factureFournisseur: { centreId } }
                        ]
                    } : {})
                },
                _sum: { montant: true }
            }),
            // Total Incoming Expected (Client Payments dated this month)
            this.prisma.paiement.findMany({
                where: {
                    date: { gte: startDate, lte: endDate },
                    statut: { not: 'ANNULE' },
                    ...(centreId ? { facture: { centreId } } : {})
                },
                select: {
                    montant: true,
                    facture: { select: { type: true } }
                }
            }),
            // Incoming Actually Cashed
            this.prisma.paiement.findMany({
                where: {
                    date: { gte: startDate, lte: endDate },
                    statut: 'ENCAISSE',
                    ...(centreId ? { facture: { centreId } } : {})
                },
                select: {
                    montant: true,
                    facture: { select: { type: true } }
                }
            }),
            // Outgoing Actually Cashed
            this.prisma.echeancePaiement.aggregate({
                where: {
                    dateEcheance: { gte: startDate, lte: endDate },
                    statut: 'ENCAISSE',
                    ...(centreId ? {
                        OR: [
                            { depense: { centreId } },
                            { factureFournisseur: { centreId } }
                        ]
                    } : {})
                },
                _sum: { montant: true }
            }),
            // Globally Pending Incoming
            this.prisma.paiement.findMany({
                where: {
                    statut: 'EN_ATTENTE',
                    ...(centreId ? { facture: { centreId } } : {})
                },
                select: {
                    montant: true,
                    facture: { select: { type: true } }
                }
            }),
            // Globally Pending Outgoing
            this.prisma.echeancePaiement.aggregate({
                where: {
                    statut: 'EN_ATTENTE',
                    ...(centreId ? {
                        OR: [
                            { depense: { centreId } },
                            { factureFournisseur: { centreId } }
                        ]
                    } : {})
                },
                _sum: { montant: true }
            }),
            this.prisma.depense.groupBy({
                by: ['categorie'],
                where: {
                    date: { gte: startDate, lte: endDate },
                    ...(centreId ? { centreId } : {})
                },
                _sum: { montant: true }
            }),
            this.prisma.factureFournisseur.groupBy({
                by: ['type'],
                where: {
                    dateEmission: { gte: startDate, lte: endDate },
                    ...(centreId ? { centreId } : {})
                },
                _sum: { montantHT: true }
            }),
            this.prisma.financeConfig.findFirst()
        ]);

        const monthlyThreshold = config?.monthlyThreshold || 50000;

        // Helper function to calculate payment total with credit note handling
        const calculatePaymentTotal = (payments: Array<{ montant: number; facture: { type: string } }>) => {
            return payments.reduce((sum, p) => {
                const multiplier = p.facture.type === 'AVOIR' ? -1 : 1;
                return sum + (p.montant * multiplier);
            }, 0);
        };

        const totalInvoicedHT = invoiceCategoryStats.reduce((acc, curr) => acc + (curr._sum.montantHT || 0), 0);
        const totalDirectExpenses = expenses._sum?.montant || 0;
        const totalExpenses = totalDirectExpenses + totalInvoicedHT;

        const totalIncoming = calculatePaymentTotal(incoming);
        const balance = totalIncoming - totalExpenses;

        const totalExpensesCashed = (expenses._sum?.montant || 0) + (echeancesCashed._sum?.montant || 0);
        const totalIncomingCashed = calculatePaymentTotal(incomingCashed);
        const balanceReal = totalIncomingCashed - totalExpensesCashed;

        // Combine categories
        const combinedCategoriesMap = new Map<string, number>();
        categoryStats.forEach(c => combinedCategoriesMap.set(c.categorie, (combinedCategoriesMap.get(c.categorie) || 0) + (c._sum.montant || 0)));
        invoiceCategoryStats.forEach(c => combinedCategoriesMap.set(c.type, (combinedCategoriesMap.get(c.type) || 0) + (c._sum.montantHT || 0)));

        const categories = Array.from(combinedCategoriesMap.entries()).map(([name, value]) => ({ name, value }));

        return {
            month,
            year,
            totalExpenses,
            totalIncoming,
            totalExpensesCashed,
            totalIncomingCashed,
            balance,
            balanceReal,
            totalIncomingPending: calculatePaymentTotal(incomingPending),
            totalOutgoingPending: echeancesPending._sum?.montant || 0,
            monthlyThreshold,
            categories
        };
    }

    async getConfig() {
        let config = await this.prisma.financeConfig.findFirst();
        if (!config) {
            config = await this.prisma.financeConfig.create({ data: { monthlyThreshold: 50000 } });
        }
        return config;
    }

    async updateConfig(threshold: number) {
        const config = await this.getConfig();
        return this.prisma.financeConfig.update({
            where: { id: config.id },
            data: { monthlyThreshold: threshold }
        });
    }

    async getConsolidatedIncomings(filters: { clientId?: string; startDate?: string; endDate?: string; centreId?: string }) {
        const where: any = {
            statut: { not: 'ANNULE' }
        };

        if (filters.centreId) {
            where.facture = { centreId: filters.centreId };
        }

        if (filters.clientId) {
            where.facture = { ...where.facture, clientId: filters.clientId };
        }

        if (filters.startDate || filters.endDate) {
            const dateRange: any = {};
            if (filters.startDate) dateRange.gte = new Date(filters.startDate);
            if (filters.endDate) dateRange.lte = new Date(filters.endDate);
            where.date = dateRange;
        }

        const payments = await this.prisma.paiement.findMany({
            where,
            include: {
                facture: {
                    include: {
                        client: { select: { nom: true, prenom: true } }
                    }
                }
            },
            orderBy: { date: 'desc' },
            take: 100
        });

        return payments.map(p => {
            const isAvoir = p.facture.type === 'AVOIR';
            const adjustedMontant = isAvoir ? -p.montant : p.montant;

            return {
                id: p.id,
                factureId: p.factureId,
                date: p.date,
                libelle: `Paiement ${p.facture.numero}${isAvoir ? ' (AVOIR)' : ''}`,
                type: p.mode,
                client: `${p.facture.client?.nom || ''} ${p.facture.client?.prenom || ''}`.trim() || 'N/A',
                montant: adjustedMontant,
                montantBrut: p.montant,
                statut: p.statut,
                source: 'FACTURE_CLIENT',
                modePaiement: p.mode,
                reference: p.reference,
                dateVersement: p.dateVersement,
                banque: p.banque,
                isAvoir
            };
        });
    }

    async getConsolidatedOutgoings(filters: { fournisseurId?: string; type?: string; startDate?: string; endDate?: string; source?: string; centreId?: string }) {
        const whereExpense: any = filters.centreId ? { centreId: filters.centreId } : {};
        const whereInvoice: any = {};

        if (filters.fournisseurId) {
            whereExpense.OR = [
                { fournisseurId: filters.fournisseurId },
                { factureFournisseur: { fournisseurId: filters.fournisseurId } }
            ];
            whereInvoice.fournisseurId = filters.fournisseurId;
        }

        if (filters.type) {
            whereExpense.categorie = filters.type;
            whereInvoice.type = filters.type;
        }

        if (filters.startDate || filters.endDate) {
            const dateRange: any = {};
            if (filters.startDate) dateRange.gte = new Date(filters.startDate);
            if (filters.endDate) dateRange.lte = new Date(filters.endDate);
            whereExpense.date = dateRange;
            whereInvoice.dateEmission = dateRange;
        }

        const [expenses, invoices] = await Promise.all([
            filters.source === 'FACTURE' ? Promise.resolve([]) : this.prisma.depense.findMany({
                where: whereExpense,
                include: {
                    centre: { select: { nom: true } },
                    fournisseur: { select: { nom: true } },
                    factureFournisseur: { include: { fournisseur: { select: { nom: true } } } }
                },
                orderBy: { date: 'desc' },
                take: 100
            }),
            filters.source === 'DEPENSE' ? Promise.resolve([]) : this.prisma.factureFournisseur.findMany({
                where: whereInvoice,
                include: {
                    fournisseur: { select: { nom: true } }
                },
                orderBy: { dateEmission: 'desc' },
                take: 100
            })
        ]);

        const consolidated = [
            ...expenses.map(e => ({
                id: e.id,
                date: e.date,
                libelle: e.description || e.categorie,
                type: e.categorie,
                fournisseur: e.fournisseur?.nom || e.factureFournisseur?.fournisseur?.nom || 'N/A',
                montant: e.montant,
                statut: e.statut,
                source: 'DEPENSE',
                modePaiement: e.modePaiement,
                reference: e.reference,
                dateEcheance: e.dateEcheance,
                montantHT: null
            })),
            ...invoices.map(i => ({
                id: i.id,
                date: i.dateEmission,
                libelle: i.numeroFacture,
                type: i.type,
                fournisseur: i.fournisseur.nom,
                montant: i.montantTTC,
                statut: i.statut,
                source: 'FACTURE',
                modePaiement: 'VOIR_ECHEANCES',
                reference: i.numeroFacture,
                dateEcheance: i.dateEcheance,
                montantHT: i.montantHT
            }))
        ];

        return consolidated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    async getYearlyProjection(year: number) {
        // Pour un graphique d'évolution sur l'année
        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        return Promise.all(months.map(m => this.getMonthlySummary(year, m)));
    }
}
