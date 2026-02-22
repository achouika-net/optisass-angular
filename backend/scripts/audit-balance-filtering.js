const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';
    const start = new Date('2000-01-01T00:00:00.000Z');
    const end = new Date('2026-02-21T23:59:59.999Z');

    // 1. Current Global Reste
    const globalAgg = await prisma.facture.aggregate({
        _sum: { resteAPayer: true },
        where: { centreId, statut: { not: 'ANNULEE' } }
    });

    // 2. Period Filtered Reste
    const periodAgg = await prisma.facture.aggregate({
        _sum: { resteAPayer: true },
        where: {
            centreId,
            statut: { not: 'ANNULEE' },
            dateEmission: { gte: start, lte: end }
        }
    });

    console.log('--- Balance Filtering Audit ---');
    console.log('Global Reste à Recouvrer:', globalAgg._sum.resteAPayer, 'DH');
    console.log('Period Reste à Recouvrer:', periodAgg._sum.resteAPayer, 'DH');
    console.log('Difference:', (globalAgg._sum.resteAPayer - periodAgg._sum.resteAPayer), 'DH');

    await prisma.$disconnect();
}

run();
