const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const factures = await prisma.facture.findMany({
        where: { centreId, statut: { not: 'ANNULEE' } },
        include: { paiements: true }
    });

    let totalOverpaidSurplus = 0;
    let overpaidCount = 0;

    for (const f of factures) {
        const totalPaid = f.paiements.reduce((sum, p) => sum + p.montant, 0);
        if (totalPaid > f.totalTTC + 0.01) {
            overpaidCount++;
            totalOverpaidSurplus += (totalPaid - f.totalTTC);
        }
    }

    console.log('--- Overpayment surplus Audit ---');
    console.log('Overpaid documents:', overpaidCount);
    console.log('Total Surplus Amount:', totalOverpaidSurplus, 'DH');

    await prisma.$disconnect();
}

run();
