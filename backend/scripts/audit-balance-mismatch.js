const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const factures = await prisma.facture.findMany({
        where: { centreId },
        include: { paiements: true }
    });

    let mismatchCount = 0;
    let totalStoredReste = 0;
    let totalCalculatedReste = 0;

    console.log('--- Balance Mismatch Audit ---');

    for (const f of factures) {
        const totalPaid = f.paiements.reduce((sum, p) => sum + p.montant, 0);
        const calculatedReste = Math.max(0, f.totalTTC - totalPaid);
        const storedReste = f.resteAPayer || 0;

        totalStoredReste += storedReste;
        totalCalculatedReste += calculatedReste;

        if (Math.abs(storedReste - calculatedReste) > 0.01) {
            mismatchCount++;
            if (mismatchCount <= 10) {
                console.log(`Facture ${f.numero}: Stored=${storedReste.toFixed(2)}, Calculated=${calculatedReste.toFixed(2)}, Diff=${(storedReste - calculatedReste).toFixed(2)}`);
            }
        }
    }

    console.log(`\nTotal Factures checked: ${factures.length}`);
    console.log(`Mismatches found: ${mismatchCount}`);
    console.log(`Total Stored Reste: ${totalStoredReste.toFixed(2)} DH`);
    console.log(`Total Calculated Reste: ${totalCalculatedReste.toFixed(2)} DH`);
    console.log(`Global Difference: ${(totalStoredReste - totalCalculatedReste).toFixed(2)} DH`);

    await prisma.$disconnect();
}

run();
