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
    constructor(private prisma: PrismaService) { }

    async getRevenueEvolution(
        period: 'daily' | 'monthly' | 'yearly',
        startDate?: string,
        endDate?: string,
        centreId?: string
    ): Promise<RevenueDataPoint[]> {
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 12));
        const end = endDate ? new Date(endDate) : new Date();

        const factures = await this.prisma.facture.findMany({
            where: {
                dateEmission: { gte: start, lte: end },
                statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] },
                type: { not: 'AVOIR' }
            },
            select: {
                dateEmission: true,
                totalTTC: true
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
            grouped.set(key, {
                revenue: existing.revenue + (f.totalTTC || 0),
                count: existing.count + 1
            });
        });

        return Array.from(grouped.entries())
            .map(([period, data]) => ({ period, ...data }))
            .sort((a, b) => a.period.localeCompare(b.period));
    }

    async getProductDistribution(centreId?: string): Promise<ProductDistribution[]> {
        const products = await this.prisma.product.findMany({
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
            dateEmission: { gte: start, lte: end }
        };

        const totalDevis = await this.prisma.facture.count({
            where: {
                ...whereClause,
                type: 'BROUILLON',
                statut: 'BROUILLON'
            }
        });

        const validatedFactures = await this.prisma.facture.count({
            where: {
                ...whereClause,
                type: 'FACTURE',
                statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] }
            }
        });

        const paidFactures = await this.prisma.facture.count({
            where: {
                ...whereClause,
                type: 'FACTURE',
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
                statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] },
                type: { not: 'AVOIR' }
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
            const existing = clientMap.get(f.clientId) || {
                name: f.client.raisonSociale || `${f.client.prenom || ''} ${f.client.nom || ''}`.trim(),
                revenue: 0,
                count: 0
            };
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

        const [totalProducts, totalClients, totalRevenue, activeWarehouses, totalDirectExpenses, totalScheduledExpenses] = await Promise.all([
            this.prisma.product.count({
                where: centreId ? {
                    entrepot: { centreId }
                } : {}
            }),
            this.prisma.client.count({
                where: centreId ? { centreId } : {}
            }),
            this.prisma.facture.aggregate({
                where: {
                    statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] },
                    type: { not: 'AVOIR' },
                    ...(centreId ? { centreId } : {}),
                    ...(start || end ? { dateEmission: { gte: start, lte: end } } : {})
                },
                _sum: { totalTTC: true }
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
            })
        ]);

        const conversionMetrics = await this.getConversionRate(startDate, endDate, centreId);

        return {
            totalProducts,
            totalClients,
            totalRevenue: totalRevenue._sum.totalTTC || 0,
            totalExpenses: (totalDirectExpenses._sum.montant || 0) + (totalScheduledExpenses._sum.montant || 0),
            activeWarehouses,
            conversionRate: conversionMetrics.conversionToFacture
        };
    }
    async getRealProfit(
        startDate?: string,
        endDate?: string,
        centreId?: string
    ) {
        try {
            console.time('TotalProfitReport');
            console.log('Getting Profit Report for:', { startDate, endDate, centreId });
            const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
            start.setHours(0, 0, 0, 0);

            const end = endDate ? new Date(endDate) : new Date();
            end.setHours(23, 59, 59, 999);

            console.log('Parsed Dates:', { start, end });

            // 1. Revenue (Factures & Avoirs) - Optimized with Aggregate
            console.time('Revenue');
            const revenueResult = await this.prisma.facture.aggregate({
                where: {
                    dateEmission: { gte: start, lte: end },
                    statut: { in: ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL'] },
                    ...(centreId ? { centreId } : {})
                },
                _sum: { totalHT: true }
            });
            console.timeEnd('Revenue');

            const revenue = revenueResult._sum.totalHT || 0;
            console.log('Revenue calculated:', revenue);

            // 2. COGS Calculation - Optimized with RAW SQL
            console.time('COGS');
            const cogsQuery = Prisma.sql`
                SELECT SUM(m."quantite" * COALESCE(m."prixAchatUnitaire", 0)) as total_cost
                FROM "MouvementStock" m
                JOIN "Facture" f ON m."factureId" = f."id"
                WHERE f."dateEmission" >= ${start}
                AND f."dateEmission" <= ${end}
                AND f."statut" IN ('VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL')
                ${centreId ? Prisma.sql`AND f."centreId" = ${centreId}` : Prisma.sql``}
            `;

            const cogsResult: any[] = await this.prisma.$queryRaw(cogsQuery);
            const rawCogs = cogsResult[0]?.total_cost || 0;

            // Logic: Sales have negative Quantity. Cost = (-1 * Price) = Negative.
            // We want COGS to be POSITIVE.
            // So COGS = -1 * Sum(Qty * Price).
            const cogs = -1 * rawCogs;
            console.timeEnd('COGS');

            console.log('COGS calculated (SQL):', cogs);

            console.time('Expenses');
            const expenses = await this.prisma.depense.aggregate({
                where: {
                    date: { gte: start, lte: end },
                    ...(centreId ? { centreId } : {})
                },
                _sum: { montant: true }
            });
            console.timeEnd('Expenses');

            console.log('Expenses aggregated:', expenses);

            // Get Breakdown by Category
            console.time('ExpenseBreakdown');
            const expenseBreakdown = await this.prisma.depense.groupBy({
                by: ['categorie'],
                where: {
                    date: { gte: start, lte: end },
                    ...(centreId ? { centreId } : {})
                },
                _sum: { montant: true },
            });
            console.timeEnd('ExpenseBreakdown');

            console.log('Breakdown calculated:', expenseBreakdown.length);

            const totalExpenses = expenses._sum.montant || 0;

            const formattedBreakdown = expenseBreakdown.map(e => ({
                category: e.categorie || 'NON DÉFINI',
                amount: e._sum.montant || 0,
                percentage: totalExpenses > 0 ? ((e._sum.montant || 0) / totalExpenses) * 100 : 0
            })).sort((a, b) => b.amount - a.amount);

            console.timeEnd('TotalProfitReport');
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
            console.error('CRITICAL ERROR IN getRealProfit:', error);
            throw error;
        }
    }
}
