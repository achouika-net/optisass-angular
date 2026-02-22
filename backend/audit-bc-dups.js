const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const bcs = await prisma.facture.findMany({
        where: {
            centreId,
            OR: [
                { type: 'BON_COMMANDE' },
                { type: 'BON_COMM' },
                { numero: { startsWith: 'BC' } },
                { statut: 'VENTE_EN_INSTANCE' }
            ],
            statut: { notIn: ['ANNULEE', 'ARCHIVE'] }
        },
        select: { numero: true, totalTTC: true }
    });

    const numCounts = new Map();
    let dupSum = 0;
    let dupCount = 0;

    for (const b of bcs) {
        const n = b.numero || 'NO_NUM';
        if (numCounts.has(n)) {
            dupSum += b.totalTTC;
            dupCount++;
            numCounts.set(n, numCounts.get(n) + 1);
        } else {
            numCounts.set(n, 1);
        }
    }

    console.log('Total BC count:', bcs.length);
    console.log('Total BC sum:', bcs.reduce((s, x) => s + (x.totalTTC || 0), 0));
    console.log('Duplicate Number count (extra docs):', dupCount);
    console.log('Duplicate sum (amount from extras):', dupSum);

    await prisma.$disconnect();
}

run();
