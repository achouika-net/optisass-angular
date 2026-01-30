import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        // 1. Revenue (Factures & Avoirs)
        // We select invoices in the period
        const factures = await this.prisma.facture.findMany({
            where: {
                dateEmission: { gte: start, lte: end },
                statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] },
                ...(centreId ? { centreId } : {})
            },
            select: {
                id: true,
                type: true,
                totalHT: true,
                mouvementsStock: {
                    select: {
                        quantite: true,
                        prixAchatUnitaire: true
                    }
                }
            }
        });

        let revenue = 0;
        let cogs = 0; // Cost of Goods Sold

        factures.forEach(f => {
            // Revenue is simply totalHT (Avoirs have negative HT)
            revenue += (f.totalHT || 0);

            // COGS Calculation
            // For Sales (negative qty), we add to COGS (as positive cost)
            // For Returns (positive qty), we subtract from COGS (recovery)
            // MouvementStock: quantite is signed (- for sale, + for return)
            // We want COGS to be a positive number representing cost
            f.mouvementsStock.forEach(m => {
                const cost = (m.quantite || 0) * (m.prixAchatUnitaire || 0);
                // cost is negative for sales (-1 * 100 = -100).
                // We subtract this negative cost to add to COGS?
                // COGS = Cost of items sold.
                // If I sold 1 item at cost 100. Mvt = -100.
                // COGS should be 100.
                // So COGS -= mvtValue.
                cogs -= cost;
            });
        });

        // 2. Expenses
        const expenses = await this.prisma.depense.aggregate({
            where: {
                date: { gte: start, lte: end },
                // Exclude linked expenses that might be COGS (purchases)?
                // Usually "Purchase of Goods" is inventory asset, not expense P&L immediately.
                // It becomes COGS when sold.
                // However, overheads (Rent, Electricity) are expenses.
                // We should filter expenses.
                // Assuming 'ACHAT_STOCK' type expenses are capitalized into stock value (Asset),
                // and thus NOT P&L expenses until sold.
                // But generally, users might put "Achat" in Depense.
                // Let's look at Depense categories or types.
                // Schema has `categorie`.
                // Ideally, we exclude "ACHAT_MARCHANDISE" if it feeds stock.
                // But for now, let's assume simplified model: All Depenses are Operational Expenses (OPEX).
                // Or user manually manages standard expenses.
                ...(centreId ? { centreId } : {})
            },
            _sum: { montant: true }
        });

        const totalExpenses = expenses._sum.montant || 0;

        return {
            period: { start, end },
            revenue,
            cogs,
            grossMargin: revenue - cogs,
            expenses: totalExpenses,
            netProfit: revenue - cogs - totalExpenses,
            analysis: {
                marginRate: revenue ? ((revenue - cogs) / revenue) * 100 : 0
            }
        };
    }
}
