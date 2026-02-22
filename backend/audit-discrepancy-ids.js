const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';
    const start = new Date('2000-01-01T00:00:00.000Z');
    const end = new Date('2026-02-21T23:59:59.999Z');

    // 1. Get all documents that manually seem like they should be in the dashboard
    const allManual = await prisma.facture.findMany({
        where: {
            centreId,
            OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            type: { not: 'AVOIR' }
        }
    });

    // 2. Get documents that satisfy the dashboard's Date Filter
    const filtered = allManual.filter(f => {
        return f.dateEmission && f.dateEmission >= start && f.dateEmission <= end;
    });

    console.log('Total in DB:', allManual.length);
    console.log('Total with Date Filter:', filtered.length);

    // If filtered.length matches what the dashboard shows (2695), then the Date Filter IS the reason.
    // BUT in my previous script, I found filtered.length was still 2843?
    // Let me re-verify that.

    console.log('--- Sample dates ---');
    for (const f of allManual.slice(0, 5)) {
        console.log(`Num: ${f.numero}, Date: ${f.dateEmission}`);
    }

    await prisma.$disconnect();
}

run();
