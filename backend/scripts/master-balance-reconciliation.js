const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const factures = await prisma.facture.findMany({
        where: { centreId, statut: { not: 'ANNULEE' } },
        include: { paiements: true }
    });

    let sumStoredReste = 0;
    let sumCalculatedReste = 0; // Sum of (TTC - Paid)
    let sumPositiveOnlyCalculatedReste = 0; // Sum of max(0, TTC - Paid)

    for (const f of factures) {
        const totalPaid = f.paiements.reduce((s, p) => s + p.montant, 0);
        const balance = f.totalTTC - totalPaid;

        sumStoredReste += (f.resteAPayer || 0);
        sumCalculatedReste += balance;
        sumPositiveOnlyCalculatedReste += Math.max(0, balance);
    }

    console.log('--- Master Balance Reconciliation ---');
    console.log('Method 1: Stored Field Sum (Current Dashboard):', sumStoredReste.toFixed(2), 'DH');
    console.log('Method 2: Net Math Sum (CA - Payments):', sumCalculatedReste.toFixed(2), 'DH');
    console.log('Method 3: Gross Debt Sum (Ignore Credits):', sumPositiveOnlyCalculatedReste.toFixed(2), 'DH');

    console.log('\nDiscrepancies:');
    console.log('Unaccounted Credit (Liability):', (sumPositiveOnlyCalculatedReste - sumCalculatedReste).toFixed(2), 'DH');
    console.log('Stale Data Difference:', (sumStoredReste - sumPositiveOnlyCalculatedReste).toFixed(2), 'DH');

    await prisma.$disconnect();
}

run();
