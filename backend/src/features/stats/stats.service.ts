import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface RevenueDataPoint {
    period: string;
    revenue: number;
    count: number;
}

export interface ProductDistribution {
    type: string;
    count: number;
    value: number;
}

export interface ConversionMetrics {
    totalDevis: number;
    validatedFactures: number;
    paidFactures: number;
    conversionToFacture: number;
    conversionToPaid: number;
}

export interface WarehouseStock {
    warehouseName: string;
    totalQuantity: number;
    totalValue: number;
    productCount: number;
}

export interface TopClient {
    clientId: string;
    clientName: string;
    totalRevenue: number;
    invoiceCount: number;
}

export interface PaymentMethodStat {
    method: string;
    count: number;
    totalAmount: number;
}

@Injectable()
export class StatsService {
    private readonly ACTIVE_STATUSES = ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL'];

    constructor(private prisma: PrismaService) { }

    async getRevenueEvolution(
        period: 'daily' | 'monthly' | 'yearly',
        startDate?: string,
        endDate?: string,
        centreId?: string
    ): Promise<RevenueDataPoint[]> {
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 12));
        const end = endDate ? new Date(endDate) : new Date();

        // CA = Factures (Validated) - Avoirs
        const factures = await this.prisma.facture.findMany({
            where: {
                dateEmission: { gte: start, lte: end },
                centreId: centreId || undefined,
                OR: [
                    {
                        // Factures
                        OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
                        statut: { in: this.ACTIVE_STATUSES }
                    },
                    {
                        // Avoirs
                        type: 'AVOIR'
                    }
                ]
            },
            select: {
                dateEmission: true,
                totalTTC: true,
                type: true
            }
        });

        const grouped = new Map<string, { revenue: number; count: number }>();

        factures.forEach(f => {
            const date = new Date(f.dateEmission);
            let key: string;

            switch (period) {
                case 'daily':
                    key = date.toISOString().split('T')[0];
                    break;
                case 'yearly':
                    key = date.getFullYear().toString();
                    break;
                case 'monthly':
                default:
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            const existing = grouped.get(key) || { revenue: 0, count: 0 };
            const amount = f.totalTTC || 0;
            const adjustedRevenue = f.type === 'AVOIR' ? existing.revenue - amount : existing.revenue + amount;

            grouped.set(key, {
                revenue: adjustedRevenue,
                count: existing.count + (f.type === 'AVOIR' ? 0 : 1) // Count only new sales
            });
        });

        return Array.from(grouped.entries())
            .map(([period, data]) => ({ period, ...data }))
            .sort((a, b) => a.period.localeCompare(b.period));
    }

    async getProductDistribution(centreId?: string): Promise<ProductDistribution[]> {
        const products = await this.prisma.product.findMany({
            where: centreId ? {
                entrepot: { centreId }
            } : {},
            select: {
                typeArticle: true,
                quantiteActuelle: true,
                prixVenteHT: true
            }
        });

        const distribution = new Map<string, { count: number; value: number }>();

        products.forEach(p => {
            const type = p.typeArticle || 'NON_DÉFINI';
            const existing = distribution.get(type) || { count: 0, value: 0 };
            distribution.set(type, {
                count: existing.count + (p.quantiteActuelle || 0),
                value: existing.value + ((p.quantiteActuelle || 0) * (p.prixVenteHT || 0))
            });
        });

        return Array.from(distribution.entries())
            .map(([type, data]) => ({ type, ...data }))
            .sort((a, b) => b.value - a.value);
    }

    async getConversionRate(
        startDate?: string,
        endDate?: string,
        centreId?: string
    ): Promise<ConversionMetrics> {
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 3));
        const end = endDate ? new Date(endDate) : new Date();

        const whereClause = {
            dateEmission: { gte: start, lte: end },
            ...(centreId ? { centreId } : {})
        };

        const totalDevis = await this.prisma.facture.count({
            where: {
                ...whereClause,
                OR: [
                    { type: 'DEVIS' },
                    { numero: { startsWith: 'BRO' } },
                    { numero: { startsWith: 'DEV' } }
                ]
            }
        });

        const validatedFactures = await this.prisma.facture.count({
            where: {
                ...whereClause,
                OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
                statut: { in: this.ACTIVE_STATUSES }
            }
        });

        const paidFactures = await this.prisma.facture.count({
            where: {
                ...whereClause,
                OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
                statut: 'PAYEE'
            }
        });

        return {
            totalDevis,
            validatedFactures,
            paidFactures,
            conversionToFacture: totalDevis > 0 ? (validatedFactures / totalDevis) * 100 : 0,
            conversionToPaid: validatedFactures > 0 ? (paidFactures / validatedFactures) * 100 : 0
        };
    }

    async getStockByWarehouse(centreId?: string): Promise<WarehouseStock[]> {
        const warehouses = await this.prisma.entrepot.findMany({
            where: centreId ? { centreId } : {},
            include: {
                produits: {
                    select: {
                        quantiteActuelle: true,
                        prixAchatHT: true
                    }
                }
            }
        });

        return warehouses.map(w => ({
            warehouseName: w.nom,
            totalQuantity: w.produits.reduce((sum, p) => sum + (p.quantiteActuelle || 0), 0),
            totalValue: w.produits.reduce((sum, p) => sum + ((p.quantiteActuelle || 0) * (p.prixAchatHT || 0)), 0),
            productCount: w.produits.length
        })).sort((a, b) => b.totalValue - a.totalValue);
    }

    async getTopClients(
        limit: number,
        startDate?: string,
        endDate?: string,
        centreId?: string
    ): Promise<TopClient[]> {
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 12));
        const end = endDate ? new Date(endDate) : new Date();

        const factures = await this.prisma.facture.findMany({
            where: {
                dateEmission: { gte: start, lte: end },
                centreId: centreId || undefined,
                OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
                statut: { in: this.ACTIVE_STATUSES }
            },
            select: {
                clientId: true,
                totalTTC: true,
                client: {
                    select: {
                        nom: true,
                        prenom: true,
                        raisonSociale: true
                    }
                }
            }
        });

        const clientMap = new Map<string, { name: string; revenue: number; count: number }>();

        factures.forEach(f => {
            const name = f.client.raisonSociale || `${f.client.prenom || ''} ${f.client.nom || ''}`.trim();
            const existing = clientMap.get(f.clientId) || { name, revenue: 0, count: 0 };
            clientMap.set(f.clientId, {
                name: existing.name,
                revenue: existing.revenue + (f.totalTTC || 0),
                count: existing.count + 1
            });
        });

        return Array.from(clientMap.entries())
            .map(([clientId, data]) => ({
                clientId,
                clientName: data.name,
                totalRevenue: data.revenue,
                invoiceCount: data.count
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, limit);
    }

    async getPaymentMethods(
        startDate?: string,
        endDate?: string,
        centreId?: string
    ): Promise<PaymentMethodStat[]> {
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 3));
        const end = endDate ? new Date(endDate) : new Date();

        const payments = await this.prisma.paiement.findMany({
            where: {
                date: { gte: start, lte: end }
            },
            select: {
                mode: true,
                montant: true
            }
        });

        const methodMap = new Map<string, { count: number; total: number }>();

        payments.forEach(p => {
            const method = p.mode || 'NON_SPÉCIFIÉ';
            const existing = methodMap.get(method) || { count: 0, total: 0 };
            methodMap.set(method, {
                count: existing.count + 1,
                total: existing.total + (p.montant || 0)
            });
        });

        return Array.from(methodMap.entries())
            .map(([method, data]) => ({
                method,
                count: data.count,
                totalAmount: data.total
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount);
    }

    async getSummary(startDate?: string, endDate?: string, centreId?: string) {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        const [totalProducts, totalClients, facturesResult, activeWarehouses, totalDirectExpenses, totalScheduledExpenses, fichesBreakdown] = await Promise.all([
            this.prisma.product.count({
                where: centreId ? {
                    entrepot: { centreId }
                } : {}
            }),
            this.prisma.client.count({
                where: centreId ? { centreId } : {}
            }),
            this.prisma.facture.findMany({
                where: {
                    centreId: centreId || undefined,
                    ...(start || end ? { dateEmission: { gte: start, lte: end } } : {}),
                    OR: [
                        {
                            // Valid Invoices
                            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
                            statut: { in: this.ACTIVE_STATUSES }
                        },
                        {
                            // Avoirs
                            type: 'AVOIR'
                        }
                    ]
                },
                select: { totalTTC: true, type: true }
            }),
            this.prisma.entrepot.count({ where: centreId ? { centreId } : {} }),
            this.prisma.depense.aggregate({
                where: {
                    echeanceId: null,
                    ...(centreId ? { centreId } : {}),
                    ...(start || end ? { date: { gte: start, lte: end } } : {})
                },
                _sum: { montant: true }
            }),
            this.prisma.echeancePaiement.aggregate({
                where: {
                    statut: { not: 'ANNULE' },
                    ...(centreId ? {
                        OR: [
                            { depense: { centreId } },
                            { factureFournisseur: { centreId } }
                        ]
                    } : {}),
                    ...(start || end ? { dateEcheance: { gte: start, lte: end } } : {})
                },
                _sum: { montant: true }
            }),
            this.prisma.fiche.groupBy({
                by: ['type'],
                where: {
                    client: centreId ? { centreId } : {}
                },
                _count: { _all: true }
            })
        ]);

        // Calculate Net Revenue
        let totalRevenue = 0;
        facturesResult.forEach(f => {
            if (f.type === 'AVOIR') totalRevenue -= (f.totalTTC || 0);
            else totalRevenue += (f.totalTTC || 0);
        });

        const conversionMetrics = await this.getConversionRate(startDate, endDate, centreId);

        const fichesStats = {
            total: 0,
            monture: 0,
            lentilles: 0,
            produit: 0
        };

        fichesBreakdown.forEach(group => {
            const count = group._count._all;
            fichesStats.total += count;
            const type = group.type.toLowerCase();
            if (type === 'monture') fichesStats.monture = count;
            else if (type === 'lentilles') fichesStats.lentilles = count;
            else if (type === 'produit') fichesStats.produit = count;
        });

        return {
            totalProducts,
            totalClients,
            totalRevenue,
            totalExpenses: (totalDirectExpenses._sum.montant || 0) + (totalScheduledExpenses._sum.montant || 0),
            activeWarehouses,
            conversionRate: conversionMetrics.conversionToFacture,
            fichesStats
        };
    }

    async getRealProfit(startDate?: string, endDate?: string, centreId?: string) {
        try {
            const tenantId = (centreId && centreId.trim() && centreId !== 'undefined' && centreId !== 'null' && centreId !== '') ? centreId : undefined;

            let start: Date;
            if (startDate && startDate !== 'undefined' && startDate !== 'null' && startDate !== '') {
                start = new Date(startDate);
            } else {
                const now = new Date();
                start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            }

            let end: Date;
            if (endDate && endDate !== 'undefined' && endDate !== 'null' && endDate !== '') {
                end = new Date(endDate);
            } else {
                const now = new Date();
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            }

            const revenueDocs = await this.prisma.facture.findMany({
                where: {
                    dateEmission: { gte: start, lte: end },
                    tenantId: tenantId ? { centreId: tenantId } : undefined, // Wait, schema check needed
                    OR: [
                        {
                            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
                            statut: { in: this.ACTIVE_STATUSES }
                        },
                        { type: 'AVOIR' }
                    ],
                    ...(tenantId ? { centreId: tenantId } : {})
                },
                select: { totalHT: true, type: true }
            });

            let revenue = 0;
            revenueDocs.forEach(d => {
                if (d.type === 'AVOIR') revenue -= (d.totalHT || 0);
                else revenue += (d.totalHT || 0);
            });

            const cogsQuery = Prisma.sql`
                SELECT SUM(m."quantite" * COALESCE(m."prixAchatUnitaire", 0)) as total_cost
                FROM "MouvementStock" m
                JOIN "Facture" f ON m."factureId" = f."id"
                WHERE f."dateEmission" >= ${start}
                AND f."dateEmission" <= ${end}
                AND ( (f."numero" LIKE 'FAC%' OR f."type" = 'FACTURE') AND f."statut" IN ('VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL') )
                ${tenantId ? Prisma.sql`AND f."centreId" = ${tenantId}` : Prisma.sql``}
            `;

            const cogsResult: any[] = await this.prisma.$queryRaw(cogsQuery);
            const rawCogs = cogsResult[0]?.total_cost || 0;
            const cogs = -1 * rawCogs;

            const expensesAgg = await this.prisma.depense.aggregate({
                where: {
                    date: { gte: start, lte: end },
                    ...(tenantId ? { centreId: tenantId } : {})
                },
                _sum: { montant: true }
            });

            const totalExpenses = expensesAgg._sum.montant || 0;

            const expenseBreakdown = await this.prisma.depense.groupBy({
                by: ['categorie'],
                where: {
                    date: { gte: start, lte: end },
                    ...(tenantId ? { centreId: tenantId } : {})
                },
                _sum: { montant: true },
            });

            const formattedBreakdown = expenseBreakdown.map(e => ({
                category: e.categorie || 'NON DÉFINI',
                amount: e._sum.montant || 0,
                percentage: totalExpenses > 0 ? ((e._sum.montant || 0) / totalExpenses) * 100 : 0
            })).sort((a, b) => b.amount - a.amount);

            return {
                period: { start, end },
                revenue,
                cogs,
                grossMargin: revenue - cogs,
                expenses: totalExpenses,
                netProfit: revenue - cogs - totalExpenses,
                expensesBreakdown: formattedBreakdown,
                analysis: {
                    marginRate: revenue ? ((revenue - cogs) / revenue) * 100 : 0
                }
            };
        } catch (error) {
            console.error('[Stats-Profit] Critical Error in getRealProfit:', error);
            throw error;
        }
    }

    async getProfitEvolution(startDate?: string, endDate?: string, centreId?: string) {
        try {
            const tenantId = (centreId && centreId.trim() && centreId !== 'undefined' && centreId !== 'null' && centreId !== '') ? centreId : undefined;

            let start: Date;
            if (startDate && startDate !== 'undefined' && startDate !== 'null' && startDate !== '') {
                start = new Date(startDate);
            } else {
                const now = new Date();
                start = new Date(now.getFullYear() - 1, now.getMonth(), 1, 0, 0, 0, 0);
            }

            let end: Date;
            if (endDate && endDate !== 'undefined' && endDate !== 'null' && endDate !== '') {
                end = new Date(endDate);
            } else {
                const now = new Date();
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            }

            const revenueQuery = Prisma.sql`
                SELECT TO_CHAR(DATE_TRUNC('month', "dateEmission"), 'YYYY-MM') as month,
                       SUM(CASE WHEN "type" = 'AVOIR' THEN -"totalHT" ELSE "totalHT" END) as revenue
                FROM "Facture"
                WHERE "dateEmission" >= ${start} AND "dateEmission" <= ${end}
                AND (
                    ( ("numero" LIKE 'FAC%' OR "type" = 'FACTURE') AND "statut" IN ('VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL') )
                    OR "type" = 'AVOIR'
                )
                ${tenantId ? Prisma.sql`AND "centreId" = ${tenantId}` : Prisma.sql``}
                GROUP BY 1
                ORDER BY 1
            `;
            const revenueRes = await this.prisma.$queryRaw(revenueQuery);

            const cogsQuery = Prisma.sql`
                SELECT TO_CHAR(DATE_TRUNC('month', f."dateEmission"), 'YYYY-MM') as month,
                       SUM(m."quantite" * COALESCE(m."prixAchatUnitaire", 0)) as total_cost
                FROM "MouvementStock" m
                JOIN "Facture" f ON m."factureId" = f."id"
                WHERE f."dateEmission" >= ${start} AND f."dateEmission" <= ${end}
                AND (f."numero" LIKE 'FAC%' OR f."type" = 'FACTURE')
                AND f."statut" IN ('VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL')
                ${tenantId ? Prisma.sql`AND f."centreId" = ${tenantId}` : Prisma.sql``}
                GROUP BY 1
                ORDER BY 1
            `;
            const cogsRes = await this.prisma.$queryRaw(cogsQuery);

            const expensesQuery = Prisma.sql`
                SELECT TO_CHAR(DATE_TRUNC('month', "date"), 'YYYY-MM') as month,
                       SUM("montant") as expense
                FROM "Depense"
                WHERE "date" >= ${start} AND "date" <= ${end}
                AND "statut" IN ('VALIDEE', 'VALIDÉ', 'PAYEE', 'PAYE')
                ${tenantId ? Prisma.sql`AND "centreId" = ${tenantId}` : Prisma.sql``}
                GROUP BY 1
                ORDER BY 1
            `;
            const expensesRes = await this.prisma.$queryRaw(expensesQuery);

            const months = new Set<string>();
            (revenueRes as any[]).forEach(r => months.add(r.month));
            (cogsRes as any[]).forEach(c => months.add(c.month));
            (expensesRes as any[]).forEach(e => months.add(e.month));

            const sortedMonths = Array.from(months).sort();

            return sortedMonths.map(month => {
                const r = (revenueRes as any[]).find(x => x.month === month);
                const c = (cogsRes as any[]).find(x => x.month === month);
                const e = (expensesRes as any[]).find(x => x.month === month);

                const revenue = r ? parseFloat(r.revenue) : 0;
                const rawCogs = c ? parseFloat(c.total_cost) : 0;
                const cogs = -1 * rawCogs;
                const expenses = e ? parseFloat(e.expense) : 0;

                return {
                    month,
                    revenue,
                    cogs,
                    expenses,
                    netProfit: revenue - cogs - expenses
                };
            });
        } catch (error) {
            console.error('[Stats-Profit] Evolution Error:', error);
            throw error;
        }
    }
}
