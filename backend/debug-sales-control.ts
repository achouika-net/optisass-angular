import { PrismaClient } from '@prisma/client';

async function debugSalesControl() {
    const prisma = new PrismaClient();
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    console.log(`--- Debugging Sales Control for Center: ${centreId} ---`);

    // 1. Check direct count of Factures matching criteria (No date filter)
    const countTotal = await prisma.facture.count({
        where: {
            centreId,
            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            type: { not: 'AVOIR' }
        }
    });
    console.log('Total Valid Factures (No Date Filter):', countTotal);

    // 2. Check with Date Filter (e.g. Month of Today)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log(`\n--- Date Filter (Current Month): ${start.toISOString()} to ${end.toISOString()} ---`);

    const countMonth = await prisma.facture.count({
        where: {
            centreId,
            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            type: { not: 'AVOIR' },
            dateEmission: { gte: start, lte: end }
        }
    });
    console.log('Valid Factures for Current Month:', countMonth);

    // 3. Test Aggregate Output
    const aggregate = await prisma.facture.aggregate({
        _sum: { totalTTC: true },
        _count: true,
        where: {
            centreId,
            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            type: { not: 'AVOIR' }
        }
    });
    console.log('\n--- Aggregate Result (No Date Filter) ---');
    console.log(JSON.stringify(aggregate, null, 2));

    // 4. Sample a few records
    const samples = await prisma.facture.findMany({
        where: {
            centreId,
            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            type: { not: 'AVOIR' }
        },
        take: 5,
        select: { numero: true, dateEmission: true, totalTTC: true, statut: true, type: true }
    });
    console.log('\n--- Samples ---');
    console.log(samples);

    await prisma.$disconnect();
}

debugSalesControl();
