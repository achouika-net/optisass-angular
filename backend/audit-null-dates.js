const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const allFactures = await prisma.facture.findMany({
        where: {
            centreId,
            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            type: { not: 'AVOIR' }
        },
        select: { totalTTC: true, dateEmission: true, numero: true }
    });

    let totalAll = 0;
    let nullDateCount = 0;
    let nullDateSum = 0;

    for (const f of allFactures) {
        totalAll += (f.totalTTC || 0);
        if (!f.dateEmission) {
            nullDateCount++;
            nullDateSum += (f.totalTTC || 0);
        }
    }

    console.log('Total Count:', allFactures.length);
    console.log('Total Sum:', totalAll);
    console.log('Null Date Count:', nullDateCount);
    console.log('Null Date Sum:', nullDateSum);
    console.log('Count (with date):', allFactures.length - nullDateCount);
    console.log('Sum (with date):', totalAll - nullDateSum);

    await prisma.$disconnect();
}

run();
