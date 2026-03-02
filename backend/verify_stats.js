const { PrismaClient } = require('@prisma/client');

class MockStatsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.ACTIVE_STATUSES = [
            'VALIDE', 'VALIDEE', 'VALIDÉ', 'VALIDÉE', 'PAYEE', 'PAYÉ', 'PAYÉE', 'SOLDEE', 'SOLDÉ', 'SOLDÉE', 'ENCAISSE', 'ENCAISSÉ', 'ENCAISSÉE', 'PARTIEL',
        ];
    }

    async getRealProfit(startDate, endDate, centreId) {
        const tenantId = centreId || undefined;
        const start = startDate ? new Date(startDate) : new Date(1970, 0, 1);
        const end = endDate ? new Date(endDate) : new Date(3000, 0, 1);

        const revenueDocs = await this.prisma.facture.findMany({
            where: {
                dateEmission: { gte: start, lte: end },
                OR: [
                    { type: { in: ['FACTURE', 'BON_COMMANDE'] }, statut: { in: this.ACTIVE_STATUSES } },
                    { type: 'AVOIR' },
                ],
                ...(tenantId ? { centreId: tenantId } : {}),
            },
            select: {
                totalHT: true,
                totalTTC: true,
                type: true,
            },
        });

        let revenue = 0;
        revenueDocs.forEach((d) => {
            const val = d.totalHT || d.totalTTC || 0;
            if (d.type === 'AVOIR') revenue -= val;
            else revenue += val;
        });

        // COGS
        let rawCogs = 0;
        const inventoryPurchaseTypes = [
            'ACHAT VERRES OPTIQUES',
            'ACHAT MONTURES OPTIQUES',
            'ACHAT LENTILLES DE CONTACT',
            'ACHAT ACCESSOIRES OPTIQUES',
            'ACHAT_STOCK',
        ];

        const globalCogsAgg = await this.prisma.factureFournisseur.aggregate({
            where: {
                dateEmission: { gte: start, lte: end },
                type: { in: inventoryPurchaseTypes },
                ...(tenantId ? { centreId: tenantId } : {}),
            },
            _sum: { montantHT: true },
        });
        rawCogs = globalCogsAgg._sum.montantHT || 0;

        // COGS Breakdown
        const cogsBreakdownRaw = await this.prisma.factureFournisseur.groupBy({
            by: ['type'],
            where: {
                dateEmission: { gte: start, lte: end },
                type: { in: inventoryPurchaseTypes },
                ...(tenantId ? { centreId: tenantId } : {}),
            },
            _sum: { montantHT: true },
        });

        const formattedCogsBreakdown = cogsBreakdownRaw.map(c => ({
            category: c.type || 'AUTRES STOCKS',
            amount: c._sum.montantHT || 0,
            percentage: rawCogs > 0 ? (c._sum.montantHT / rawCogs) * 100 : 0
        }));

        return {
            revenue,
            rawCogs,
            cogsBreakdown: formattedCogsBreakdown,
            expenses: 0, // Simplified for script
            netProfit: revenue - rawCogs
        };
    }
}

async function run() {
    const prisma = new PrismaClient();
    const service = new MockStatsService(prisma);
    const result = await service.getRealProfit();
    console.log(JSON.stringify(result, null, 2));
    await prisma.$disconnect();
}

run();
