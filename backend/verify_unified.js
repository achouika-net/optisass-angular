const { PrismaClient } = require('@prisma/client');

class MockStatsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.INVENTORY_PURCHASE_TYPES = [
            'ACHAT VERRES OPTIQUES',
            'ACHAT MONTURES OPTIQUES',
            'ACHAT LENTILLES DE CONTACT',
            'ACHAT ACCESSOIRES OPTIQUES',
            'ACHAT_STOCK',
        ];
        this.ACTIVE_STATUSES = [
            'VALIDE', 'VALIDEE', 'VALIDÉ', 'VALIDÉE', 'PAYEE', 'PAYÉ', 'PAYÉE', 'SOLDEE', 'SOLDÉ', 'SOLDÉE', 'ENCAISSE', 'ENCAISSÉ', 'ENCAISSÉE', 'PARTIEL'
        ];
    }

    async getProfitEvolution() {
        const start = new Date(1970, 0, 1);
        const end = new Date(3000, 0, 1);
        const monthsMap = new Map();

        const getMonthKey = (date) => {
            if (!date || isNaN(date.getTime())) return null;
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        };

        const factures = await this.prisma.facture.findMany({
            where: {
                dateEmission: { gte: start, lte: end },
                OR: [
                    { type: { in: ['FACTURE', 'BON_COMMANDE'] }, statut: { in: this.ACTIVE_STATUSES } },
                    { type: 'AVOIR' },
                ],
            },
            select: { dateEmission: true, totalHT: true, totalTTC: true, type: true },
        });

        factures.forEach((f) => {
            const key = getMonthKey(f.dateEmission);
            if (!key) return;
            if (!monthsMap.has(key)) monthsMap.set(key, { revenue: 0, cogs: 0, expenses: 0 });
            const val = f.totalHT || f.totalTTC || 0;
            const entry = monthsMap.get(key);
            if (f.type === 'AVOIR') entry.revenue -= val;
            else entry.revenue += val;
        });

        const ff = await this.prisma.factureFournisseur.findMany({
            where: { dateEmission: { gte: start, lte: end } },
        });

        ff.forEach((f) => {
            const key = getMonthKey(f.dateEmission);
            if (!key) return;
            if (!monthsMap.has(key)) monthsMap.set(key, { revenue: 0, cogs: 0, expenses: 0 });
            const entry = monthsMap.get(key);
            const isInventory = this.INVENTORY_PURCHASE_TYPES.includes(f.type || '');
            if (isInventory) entry.cogs += f.montantHT || 0;
            else entry.expenses += f.montantHT || 0;
        });

        return Array.from(monthsMap.entries())
            .map(([month, vals]) => ({
                month,
                revenue: vals.revenue,
                expenses: vals.cogs + vals.expenses, // Unified
                netProfit: vals.revenue - vals.cogs - vals.expenses,
            }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }
}

async function run() {
    const prisma = new PrismaClient();
    const service = new MockStatsService(prisma);
    const evolution = await service.getProfitEvolution();

    console.log('--- Unofficial Evolution Result (First 5) ---');
    console.log(evolution.slice(0, 5));

    const totalExpenses = evolution.reduce((acc, curr) => acc + curr.expenses, 0);
    console.log('Total Expenses in Chart (Unified):', totalExpenses);

    await prisma.$disconnect();
}

run();
