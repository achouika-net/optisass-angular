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
    breakdown: { type: string; quantity: number; value: number }[];
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

        // CA = toutes les ventes (DEVIS=vente avec facture, BON_COMMANDE=vente sans facture, FACTURE) + Avoirs
        const factures = await this.prisma.facture.findMany({
            where: {
                dateEmission: { gte: start, lte: end },
                centreId: centreId || undefined,
                statut: { notIn: ['ANNULEE', 'ARCHIVE'] },
                OR: [
                    { type: 'DEVIS' },         // vente avec facture (importée)
                    { type: 'BON_COMMANDE' },  // vente sans facture (importée)
                    { type: 'BON_COMM' },
                    { type: 'FACTURE' },
                    { numero: { startsWith: 'FAC' } },
                    { type: 'AVOIR' }
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

    async getProductDistribution(startDate?: string, endDate?: string, centreId?: string): Promise<ProductDistribution[]> {
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
            ...(centreId ? { centreId } : {}),
            statut: { notIn: ['ANNULEE', 'ARCHIVE'] }
        };

        // Total ventes (toutes catégories confondues)
        const totalDevis = await this.prisma.facture.count({
            where: {
                ...whereClause,
                OR: [
                    { type: 'DEVIS' },
                    { type: 'BON_COMMANDE' },
                    { type: 'BON_COMM' },
                    { type: 'FACTURE' },
                    { numero: { startsWith: 'FAC' } }
                ]
            }
        });

        // Ventes avec au moins un paiement = "converties"
        const validatedFactures = await this.prisma.facture.count({
            where: {
                ...whereClause,
                OR: [
                    { type: 'DEVIS' },
                    { type: 'BON_COMMANDE' },
                    { type: 'BON_COMM' },
                    { type: 'FACTURE' },
                    { numero: { startsWith: 'FAC' } }
                ],
                paiements: { some: {} }
            }
        });

        // Ventes entièrement payées
        const paidFactures = await this.prisma.facture.count({
            where: {
                ...whereClause,
                OR: [
                    { type: 'DEVIS' },
                    { type: 'BON_COMMANDE' },
                    { type: 'BON_COMM' },
                    { type: 'FACTURE' },
                    { numero: { startsWith: 'FAC' } }
                ],
                statut: { in: ['PAYEE', 'SOLDEE', 'ENCAISSE'] }
            }
        });

        return {
            totalDevis,
            validatedFactures,
            paidFactures,
            conversionToFacture: totalDevis > 0 ? (validatedFactures / totalDevis) * 100 : 0,
            conversionToPaid: totalDevis > 0 ? (paidFactures / totalDevis) * 100 : 0
        };
    }

    async getStockByWarehouse(startDate?: string, endDate?: string, centreId?: string): Promise<WarehouseStock[]> {
        const warehouses = await this.prisma.entrepot.findMany({
            where: centreId ? { centreId } : {},
            include: {
                produits: {
                    select: {
                        typeArticle: true,
                        quantiteActuelle: true,
                        prixAchatHT: true,
                        prixVenteHT: true
                    }
                }
            }
        });

        return warehouses.map(w => {
            const breakdownMap = new Map<string, { quantity: number; value: number }>();

            w.produits.forEach(p => {
                const type = p.typeArticle || 'NON_DÉFINI';
                const existing = breakdownMap.get(type) || { quantity: 0, value: 0 };
                breakdownMap.set(type, {
                    quantity: existing.quantity + (p.quantiteActuelle || 0),
                    value: existing.value + ((p.quantiteActuelle || 0) * (p.prixAchatHT || 0))
                });
            });

            const breakdown = Array.from(breakdownMap.entries()).map(([type, data]) => ({
                type,
                quantity: data.quantity,
                value: data.value
            }));

            const totalQuantity = w.produits.reduce((sum, p) => sum + (p.quantiteActuelle || 0), 0);
            const totalValue = w.produits.reduce((sum, p) => sum + ((p.quantiteActuelle || 0) * (p.prixAchatHT || 0)), 0);

            return {
                warehouseName: w.nom,
                totalQuantity,
                totalValue,
                productCount: w.produits.length,
                breakdown
            };
        }).sort((a, b) => b.totalValue - a.totalValue);
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
                statut: { notIn: ['ANNULEE', 'ARCHIVE'] },
                OR: [
                    { type: 'DEVIS' },
                    { type: 'BON_COMMANDE' },
                    { type: 'BON_COMM' },
                    { type: 'FACTURE' },
                    { numero: { startsWith: 'FAC' } }
                ]
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
                date: { gte: start, lte: end },
                ...(centreId ? { facture: { centreId } } : {})
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
                    statut: { notIn: ['ANNULEE', 'ARCHIVE'] },
                    OR: [
                        { type: 'DEVIS' },         // vente avec facture (importée)
                        { type: 'BON_COMMANDE' },  // vente sans facture (importée)
                        { type: 'BON_COMM' },
                        { type: 'FACTURE' },
                        { numero: { startsWith: 'FAC' } },
                        { type: 'AVOIR' }
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

            const end = (endDate && endDate !== 'undefined' && endDate !== 'null' && endDate !== '') ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 23, 59, 59, 999);

            const revenueDocs = await this.prisma.facture.findMany({
                where: {
                    dateEmission: { gte: start, lte: end },
                    OR: [
                        {
                            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }, { type: 'BON_COMMANDE' }],
                            statut: { in: this.ACTIVE_STATUSES }
                        },
                        { type: 'AVOIR' }
                    ],
                    ...(tenantId ? { centreId: tenantId } : {})
                },
                select: { id: true, totalHT: true, type: true, lignes: true, ficheId: true }
            });

            let revenue = 0;
            revenueDocs.forEach(d => {
                if (d.type === 'AVOIR') revenue -= (d.totalHT || 0);
                else revenue += (d.totalHT || 0);
            });

            // 1. Primary COGS from MouvementStock
            const cogsQuery = Prisma.sql`
                SELECT SUM(m."quantite" * COALESCE(m."prixAchatUnitaire", 0)) as total_cost
                FROM "MouvementStock" m
                JOIN "Facture" f ON m."factureId" = f."id"
                WHERE f."dateEmission" >= ${start}
                AND f."dateEmission" <= ${end}
                AND ( (f."numero" LIKE 'FAC%' OR f."type" = 'FACTURE' OR f."type" = 'BON_COMMANDE') AND f."statut" IN ('VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL') )
                ${tenantId ? Prisma.sql`AND f."centreId" = ${tenantId}` : Prisma.sql``}
            `;
            const cogsResult = await this.prisma.$queryRaw<any[]>(cogsQuery);
            let rawCogs = Math.abs(Number(cogsResult[0]?.total_cost || 0));

            // 2. Secondary COGS from linked BL Verre (via FicheId)
            const ficheIds = revenueDocs
                .map(d => d.ficheId)
                .filter((id): id is string => !!id && typeof id === 'string');

            if (ficheIds.length > 0) {
                const linkedBls = await this.prisma.factureFournisseur.aggregate({
                    where: {
                        ficheId: { in: ficheIds },
                        isBL: true
                    },
                    _sum: { montantHT: true }
                });
                rawCogs += (linkedBls?._sum?.montantHT || 0);
            }

            // 3. Fallback COGS for items with no movements (estimations based on Product prices)
            // Only run if stock movements are suspiciously low/missing for the revenue
            if (rawCogs < (revenue * 0.1) && revenue > 0) {
                let estimatedCogs = 0;
                for (const doc of revenueDocs) {
                    if (doc.type === 'AVOIR') continue;
                    const lines = (doc.lignes as any[]) || [];
                    for (const line of lines) {
                        if (line.description) {
                            // Simple heuristic: search for product by designation
                            const product = await this.prisma.product.findFirst({
                                where: { designation: line.description },
                                select: { prixAchatHT: true }
                            });
                            if (product && product.prixAchatHT > 0) {
                                estimatedCogs += (line.qte || 1) * product.prixAchatHT;
                            }
                        }
                    }
                }
                if (estimatedCogs > rawCogs) rawCogs = estimatedCogs;
            }

            const cogs = -1 * rawCogs;

            // --- EXPENSES ---
            // 1. Direct expenses from Depense table
            const expensesAgg = await this.prisma.depense.aggregate({
                where: {
                    date: { gte: start, lte: end },
                    ...(tenantId ? { centreId: tenantId } : {})
                },
                _sum: { montant: true }
            });

            // 2. Operational expenses from FactureFournisseur (Supplier Invoices that are not inventory)
            const operationalPurchaseTypes = [
                'REGLEMENT CONSOMMATION EAU', 'REGLEMENT SALAIRS OPTIQUES', 'LOYER',
                'ELECTRICITE', 'INTERNET', 'ASSURANCE', 'FRAIS BANCAIRES', 'AUTRES CHARGES'
            ];
            const purchaseExpensesAgg = await this.prisma.factureFournisseur.aggregate({
                where: {
                    dateEmission: { gte: start, lte: end },
                    isBL: false,
                    OR: [
                        { type: { in: operationalPurchaseTypes } },
                        { type: { notIn: ['ACHAT VERRES OPTIQUES', 'ACHAT MONTURES', 'ACHAT LENTILLES DE CONTACT', 'ACHAT ACCESSOIRES', 'ACHAT STOCK'] } }
                    ],
                    ...(tenantId ? { centreId: tenantId } : {})
                },
                _sum: { montantHT: true }
            });

            const totalExpenses = (expensesAgg._sum.montant || 0) + (purchaseExpensesAgg._sum.montantHT || 0);

            // Expense breakdown combine Depense and FactureFournisseur
            const expenseBreakdown = await this.prisma.depense.groupBy({
                by: ['categorie'],
                where: {
                    date: { gte: start, lte: end },
                    ...(tenantId ? { centreId: tenantId } : {})
                },
                _sum: { montant: true },
            });

            const purchaseBreakdown = await this.prisma.factureFournisseur.groupBy({
                by: ['type'],
                where: {
                    dateEmission: { gte: start, lte: end },
                    isBL: false,
                    OR: [
                        { type: { in: operationalPurchaseTypes } },
                        { type: { notIn: ['ACHAT VERRES OPTIQUES', 'ACHAT MONTURES', 'ACHAT LENTILLES DE CONTACT', 'ACHAT ACCESSOIRES', 'ACHAT STOCK'] } }
                    ],
                    ...(tenantId ? { centreId: tenantId } : {})
                },
                _sum: { montantHT: true }
            });

            const combinedBreakdownMap = new Map<string, number>();
            expenseBreakdown.forEach(e => combinedBreakdownMap.set(e.categorie || 'AUTRES', (combinedBreakdownMap.get(e.categorie || 'AUTRES') || 0) + (e._sum.montant || 0)));
            purchaseBreakdown.forEach(p => combinedBreakdownMap.set(p.type || 'AUTRES PURCHASES', (combinedBreakdownMap.get(p.type || 'AUTRES PURCHASES') || 0) + (p._sum.montantHT || 0)));

            const formattedBreakdown = Array.from(combinedBreakdownMap.entries()).map(([category, amount]) => ({
                category,
                amount,
                percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
            })).sort((a, b) => b.amount - a.amount);

            const netProfit = revenue - rawCogs - totalExpenses;

            return {
                revenue,
                cogs: rawCogs,
                expenses: totalExpenses,
                grossProfit: revenue - rawCogs,
                netProfit,
                expensesBreakdown: formattedBreakdown,
                analysis: {
                    grossMarginRate: revenue ? ((revenue - rawCogs) / revenue) * 100 : 0,
                    marginRate: revenue ? (netProfit / revenue) * 100 : 0
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
                    ( ("numero" LIKE 'FAC%' OR "type" = 'FACTURE' OR "type" = 'BON_COMMANDE') AND "statut" IN ('VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL') )
                    OR "type" = 'AVOIR'
                )
                ${tenantId ? Prisma.sql`AND "centreId" = ${tenantId}` : Prisma.sql``}
                GROUP BY 1
                ORDER BY 1
            `;
            const revenueRes = await this.prisma.$queryRaw<any[]>(revenueQuery);

            const cogsQuery = Prisma.sql`
                SELECT TO_CHAR(DATE_TRUNC('month', f."dateEmission"), 'YYYY-MM') as month,
                       SUM(m."quantite" * COALESCE(m."prixAchatUnitaire", 0)) as total_cost
                FROM "MouvementStock" m
                JOIN "Facture" f ON m."factureId" = f."id"
                WHERE f."dateEmission" >= ${start} AND f."dateEmission" <= ${end}
                AND (f."numero" LIKE 'FAC%' OR f."type" = 'FACTURE' OR f."type" = 'BON_COMMANDE')
                AND f."statut" IN ('VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL')
                ${tenantId ? Prisma.sql`AND f."centreId" = ${tenantId}` : Prisma.sql``}
                GROUP BY 1
                ORDER BY 1
            `;
            const cogsRes = await this.prisma.$queryRaw<any[]>(cogsQuery);

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
            const expensesRes = await this.prisma.$queryRaw<any[]>(expensesQuery);

            const purchaseExpensesQuery = Prisma.sql`
                SELECT TO_CHAR(DATE_TRUNC('month', "dateEmission"), 'YYYY-MM') as month,
                       SUM("montantHT") as expense
                FROM "FactureFournisseur"
                WHERE "dateEmission" >= ${start} AND "dateEmission" <= ${end}
                AND "isBL" = false
                AND (
                    "type" IN ('ELECTRICITE', 'INTERNET', 'ASSURANCE', 'FRAIS BANCAIRES', 'AUTRES CHARGES', 'REGLEMENT CONSOMMATION EAU', 'REGLEMENT SALAIRS OPTIQUES', 'LOYER')
                    OR "type" NOT IN ('ACHAT VERRES OPTIQUES', 'ACHAT MONTURES', 'ACHAT LENTILLES DE CONTACT', 'ACHAT ACCESSOIRES', 'ACHAT STOCK')
                )
                ${tenantId ? Prisma.sql`AND "centreId" = ${tenantId}` : Prisma.sql``}
                GROUP BY 1
            `;
            const pExpensesRes = await this.prisma.$queryRaw<any[]>(purchaseExpensesQuery);

            const months = new Set<string>();
            revenueRes.forEach((r: any) => months.add(r.month));
            cogsRes.forEach((c: any) => months.add(c.month));
            expensesRes.forEach((e: any) => months.add(e.month));
            pExpensesRes.forEach((pe: any) => months.add(pe.month));

            const sortedMonths = Array.from(months).sort();

            return sortedMonths.map(month => {
                const r = revenueRes.find((x: any) => x.month === month);
                const c = cogsRes.find((x: any) => x.month === month);
                const e = expensesRes.find((x: any) => x.month === month);
                const pe = pExpensesRes.find((x: any) => x.month === month);

                const revenue = r ? parseFloat(r.revenue || 0) : 0;
                const rawCogs = Math.abs(parseFloat(c?.total_cost || 0));
                const expenses = parseFloat(e?.expense || 0) + parseFloat(pe?.expense || 0);

                return {
                    month,
                    revenue,
                    cogs: rawCogs,
                    expenses,
                    netProfit: revenue - rawCogs - expenses
                };
            });
        } catch (error) {
            console.error('[Stats-Profit] Evolution Error:', error);
            throw error;
        }
    }
}
