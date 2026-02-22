const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';
    const start = new Date('2000-01-01T00:00:00.000Z');
    const end = new Date('2026-02-21T23:59:59.999Z');

    const allRelevant = await prisma.facture.findMany({
        where: {
            centreId,
            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            type: { not: 'AVOIR' }
        },
        select: { id: true, numero: true, dateEmission: true, totalTTC: true }
    });

    const missing = allRelevant.filter(f => {
        return !f.dateEmission || f.dateEmission < start || f.dateEmission > end;
    });

    console.log('Total Relevant Docs:', allRelevant.length);
    console.log('Missing Docs (Date):', missing.length);
    const missingSum = missing.reduce((s, x) => s + (x.totalTTC || 0), 0);
    console.log('Missing Sum:', missingSum);

    if (missing.length > 0) {
        console.log('Samples of missing docs:');
        console.log(missing.slice(0, 10).map(m => ({
            numero: m.numero,
            date: m.dateEmission,
            total: m.totalTTC
        })));
    }

    await prisma.$disconnect();
}

run();
