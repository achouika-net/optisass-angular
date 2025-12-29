import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TreasuryService {
    constructor(private prisma: PrismaService) { }

    async getMonthlySummary(year: number, month: number, centreId?: string) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const results = await Promise.all([
            // Outgoings (Direct Expenses: Any mode but NOT linked to an Echeance)
            // This captures Cash/Card and also Cheques that were not scheduled (Immediate)
            this.prisma.depense.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                    centreId: centreId,
                    echeanceId: null
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
            // [OPTIMIZED] Total Incoming Expected: Standard vs Avoir
            this.prisma.paiement.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                    statut: { not: 'ANNULE' },
                    facture: { type: { not: 'AVOIR' }, ...(centreId ? { centreId } : {}) }
                },
                _sum: { montant: true }
            }),
            this.prisma.paiement.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                    statut: { not: 'ANNULE' },
                    facture: { type: 'AVOIR', ...(centreId ? { centreId } : {}) }
                },
                _sum: { montant: true }
            }),

            // [OPTIMIZED] Incoming Actually Cashed: Standard vs Avoir
            this.prisma.paiement.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                    statut: 'ENCAISSE',
                    facture: { type: { not: 'AVOIR' }, ...(centreId ? { centreId } : {}) }
                },
                _sum: { montant: true }
            }),
            this.prisma.paiement.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                    statut: 'ENCAISSE',
                    facture: { type: 'AVOIR', ...(centreId ? { centreId } : {}) }
                },
                _sum: { montant: true }
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

            // [OPTIMIZED] Globally Pending Incoming: Standard vs Avoir
            this.prisma.paiement.aggregate({
                where: {
                    statut: 'EN_ATTENTE',
                    facture: { type: { not: 'AVOIR' }, ...(centreId ? { centreId } : {}) }
                },
                _sum: { montant: true }
            }),
            this.prisma.paiement.aggregate({
                where: {
                    statut: 'EN_ATTENTE',
                    facture: { type: 'AVOIR', ...(centreId ? { centreId } : {}) }
                },
                _sum: { montant: true }
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
                    centreId: centreId,

                },
                _sum: { montant: true }
            }),
            this.prisma.factureFournisseur.groupBy({
                by: ['type'],
                where: {
                    dateEmission: { gte: startDate, lte: endDate },
                    ...(centreId ? { centreId } : {})
                },
                _sum: { montantTTC: true }
            }),
            this.prisma.financeConfig.findFirst(),
            // [NEW] Cash Incoming (Standard)
            this.prisma.paiement.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                    statut: 'ENCAISSE',
                    mode: 'ESPECES',
                    facture: { type: { not: 'AVOIR' }, ...(centreId ? { centreId } : {}) }
                },
                _sum: { montant: true }
            }),
            // [NEW] Cash Incoming (Avoir)
            this.prisma.paiement.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                    statut: 'ENCAISSE',
                    mode: 'ESPECES',
                    facture: { type: 'AVOIR', ...(centreId ? { centreId } : {}) }
                },
                _sum: { montant: true }
            }),
            // [NEW] Card Incoming (Standard)
            this.prisma.paiement.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                    statut: 'ENCAISSE',
                    mode: 'CARTE',
                    facture: { type: { not: 'AVOIR' }, ...(centreId ? { centreId } : {}) }
                },
                _sum: { montant: true }
            }),
            // [NEW] Card Incoming (Avoir)
            this.prisma.paiement.aggregate({
                where: {
                    date: { gte: startDate, lte: endDate },
                    statut: 'ENCAISSE',
                    mode: 'CARTE',
                    facture: { type: 'AVOIR', ...(centreId ? { centreId } : {}) }
                },
                _sum: { montant: true }
            })
        ]);

        const expenses = results[0];
        const echeances = results[1];
        const incomingStandard = (results[2] as any)._sum.montant || 0;
        const incomingAvoir = (results[3] as any)._sum.montant || 0;
        const incomingCashedStandard = (results[4] as any)._sum.montant || 0;
        const incomingCashedAvoir = (results[5] as any)._sum.montant || 0;

        // echeancesCashed is results[6]
        const echeancesCashed = results[6];

        const incomingPendingStandard = (results[7] as any)._sum.montant || 0;
        const incomingPendingAvoir = (results[8] as any)._sum.montant || 0;

        const echeancesPending = results[9];
        const categoryStats = results[10];
        const invoiceCategoryStats = results[11];
        const config = results[12] as any;

        const monthlyThreshold = config?.monthlyThreshold || 50000;

        // Calculations
        // [FIX] Treasury View: Expenses = Direct Expenses + Scheduled Payments (Echeances)
        // Previously it was Invoiced HT, which is Accounting View (based on emission date)
        const totalScheduled = (echeances as any)._sum?.montant || 0;
        const totalDirectExpenses = expenses._sum?.montant || 0;
        const totalExpenses = totalDirectExpenses + totalScheduled;

        const totalIncoming = incomingStandard - incomingAvoir;
        const balance = totalIncoming - totalExpenses;

        const totalExpensesCashed = (expenses._sum?.montant || 0) + (echeancesCashed._sum?.montant || 0);
        const totalIncomingCashed = incomingCashedStandard - incomingCashedAvoir;
        const balanceReal = totalIncomingCashed - totalExpensesCashed;

        // Combine categories
        const combinedCategoriesMap = new Map<string, number>();
        (categoryStats as any[]).forEach(c => combinedCategoriesMap.set(c.categorie, (combinedCategoriesMap.get(c.categorie) || 0) + (c._sum.montant || 0)));
        (invoiceCategoryStats as any[]).forEach(c => combinedCategoriesMap.set(c.type, (combinedCategoriesMap.get(c.type) || 0) + (c._sum.montantTTC || 0)));

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
            totalIncomingPending: incomingPendingStandard - incomingPendingAvoir,
            totalOutgoingPending: echeancesPending._sum?.montant || 0,
            monthlyThreshold,
            categories,
            incomingCash: ((results[13] as any)._sum.montant || 0) - ((results[14] as any)._sum.montant || 0),
            incomingCard: ((results[15] as any)._sum.montant || 0) - ((results[16] as any)._sum.montant || 0)
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

    async getConsolidatedIncomings(filters: { clientId?: string; startDate?: string; endDate?: string; centreId?: string; mode?: string }) {
        const where: any = {
            statut: { not: 'ANNULE' }
        };

        if (filters.mode) {
            const modes = filters.mode.split(',');
            where.mode = { in: modes };
        }

        if (filters.centreId) {
            where.facture = { centreId: filters.centreId };
        }

        if (filters.clientId) {
            where.facture = { ...where.facture, clientId: filters.clientId };
        }

        if (filters.startDate || filters.endDate) {
            const dateRange: any = {};
            if (filters.startDate) {
                const start = new Date(filters.startDate);
                start.setHours(0, 0, 0, 0);
                dateRange.gte = start;
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                dateRange.lte = end;
            }
            where.date = dateRange;
        }

        console.log('[TREASURY-INCOMINGS] Filters:', filters);
        console.log('[TREASURY-INCOMINGS] Where:', JSON.stringify(where, null, 2));

        const startTime = Date.now();
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

        console.log(`[TREASURY-INCOMINGS] Query took ${Date.now() - startTime}ms. Found ${payments.length} records.`);

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
                dateVersement: p.dateVersement, // Planned date
                dateEncaissement: p.dateEncaissement, // Actual date
                banque: p.banque,
                isAvoir
            };
        });
    }

    async getConsolidatedOutgoings(filters: { fournisseurId?: string; type?: string; startDate?: string; endDate?: string; source?: string; centreId?: string; mode?: string }) {
        // If mode (CHEQUE, LCN) is provided, we fetch individual pieces (EcheancePaiement)
        if (filters.mode && (filters.mode.includes('CHEQUE') || filters.mode.includes('LCN'))) {
            const where: any = {
                type: { in: filters.mode.split(',') }
            };

            if (filters.startDate || filters.endDate) {
                const dateRange: any = {};
                if (filters.startDate) dateRange.gte = new Date(filters.startDate);
                if (filters.endDate) dateRange.lte = new Date(filters.endDate);
                where.dateEcheance = dateRange;
            }

            const pieces = await this.prisma.echeancePaiement.findMany({
                where,
                include: {
                    factureFournisseur: { include: { fournisseur: { select: { nom: true } } } },
                    depense: { include: { fournisseur: { select: { nom: true } } } }
                },
                orderBy: { dateEcheance: 'desc' }
            });

            return pieces.map(p => ({
                id: p.id,
                date: p.dateEcheance,
                libelle: p.factureFournisseur?.numeroFacture || p.depense?.description || p.depense?.categorie || 'N/A',
                type: p.type,
                fournisseur: p.factureFournisseur?.fournisseur?.nom || p.depense?.fournisseur?.nom || 'N/A',
                montant: p.montant,
                statut: p.statut,
                source: p.factureFournisseur ? 'FACTURE' : 'DEPENSE',
                modePaiement: p.type,
                reference: p.reference,
                banque: p.banque,
                dateEcheance: p.dateEcheance, // Valeur
                dateEncaissement: p.dateEncaissement, // Actual
                createdAt: p.createdAt // Creation date
            }));
        }

        // Default behavior (group by invoice/expense)
        const whereExpense: any = filters.centreId ? { centreId: filters.centreId } : {};
        const whereInvoice: any = filters.centreId ? { centreId: filters.centreId } : {};

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
            if (filters.startDate) {
                const start = new Date(filters.startDate);
                start.setHours(0, 0, 0, 0);
                dateRange.gte = start;
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                dateRange.lte = end;
            }
            whereExpense.date = dateRange;
            whereInvoice.dateEmission = dateRange;
        }

        const [expenses, invoices] = await Promise.all([
            filters.source === 'FACTURE' ? Promise.resolve([]) : this.prisma.depense.findMany({
                where: whereExpense,
                include: {
                    centre: { select: { nom: true } },
                    fournisseur: { select: { nom: true } },
                    factureFournisseur: { include: { fournisseur: { select: { nom: true } } } },
                    echeance: true
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
                montant: Number(e.montant),
                statut: e.statut,
                source: 'DEPENSE',
                modePaiement: e.modePaiement,
                reference: e.reference,
                banque: e.echeance?.banque || null,
                dateEcheance: e.dateEcheance,
                dateEncaissement: e.echeance?.dateEncaissement || null,
                montantHT: null
            })),
            ...invoices.map(i => ({
                id: i.id,
                date: i.dateEmission,
                libelle: i.numeroFacture,
                type: i.type,
                fournisseur: i.fournisseur.nom,
                montant: Number(i.montantTTC),
                statut: i.statut,
                source: 'FACTURE',
                modePaiement: 'VOIR_ECHEANCES',
                reference: i.numeroFacture,
                dateEcheance: i.dateEcheance,
                dateEncaissement: null,
                montantHT: Number(i.montantHT)
            }))
        ];

        return consolidated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    async getYearlyProjection(year: number) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);

        // Fetch all data for the year in parallel (Optimization: 2 queries instead of 132)
        const [expenses, echeances] = await Promise.all([
            this.prisma.depense.findMany({
                where: {
                    date: { gte: startDate, lte: endDate },
                    echeanceId: null // Only expenses NOT linked to an Echeance
                },
                select: { date: true, montant: true }
            }),
            this.prisma.echeancePaiement.findMany({
                where: {
                    dateEcheance: { gte: startDate, lte: endDate },
                    statut: { not: 'ANNULE' }
                },
                select: { dateEcheance: true, montant: true }
            })
        ]);

        // Aggregate by month in memory
        const monthlyData = new Array(12).fill(0).map((_, i) => ({
            month: i + 1,
            totalExpenses: 0
        }));

        expenses.forEach(e => {
            const m = new Date(e.date).getMonth();
            if (m >= 0 && m < 12) monthlyData[m].totalExpenses += Number(e.montant || 0);
        });

        echeances.forEach(e => {
            const m = new Date(e.dateEcheance).getMonth();
            if (m >= 0 && m < 12) monthlyData[m].totalExpenses += Number(e.montant || 0);
        });

        return monthlyData;
    }

    async updateEcheanceStatus(id: string, statut: string) {
        const data: any = { statut };
        if (statut === 'ENCAISSE' || statut === 'PAYE') {
            data.dateEncaissement = new Date();
        }

        return this.prisma.echeancePaiement.update({
            where: { id },
            data
        });
    }
}
