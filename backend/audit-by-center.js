const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const docs = await prisma.facture.findMany({
        where: {
            OR: [{ type: 'FACTURE' }, { numero: { startsWith: 'FAC' } }]
        },
        select: { centreId: true, totalTTC: true }
    });

    const byCenter = {};
    for (const x of docs) {
        const c = x.centreId || 'NULL';
        if (!byCenter[c]) byCenter[c] = { count: 0, total: 0 };
        byCenter[c].count++;
        byCenter[c].total += (x.totalTTC || 0);
    }

    console.log('--- Facture count by Center ---');
    console.log(JSON.stringify(byCenter, null, 2));

    await prisma.$disconnect();
}

run();
