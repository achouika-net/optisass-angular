const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const payments = await prisma.paiement.findMany({
        where: { facture: { centreId } },
        select: { montant: true, date: true }
    });

    const byMonth = {};
    for (const p of payments) {
        if (!p.date) continue;
        const d = new Date(p.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth[key] = (byMonth[key] || 0) + p.montant;
    }

    const sortedMonths = Object.keys(byMonth).sort();
    console.log('--- Payments by Month ---');
    sortedMonths.forEach(m => {
        console.log(`${m}: ${byMonth[m].toFixed(2)} DH`);
    });

    await prisma.$disconnect();
}

run();
