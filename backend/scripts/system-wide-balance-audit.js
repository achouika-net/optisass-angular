const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const factures = await prisma.facture.findMany({
        include: { paiements: true }
    });

    let mismatchCount = 0;
    let totalFix = 0;

    console.log('--- System-wide Balance Audit ---');

    for (const f of factures) {
        const totalPaid = f.paiements.reduce((sum, p) => sum + p.montant, 0);
        // Rounded to 2 decimals to avoid floating point issues
        const calculatedReste = parseFloat((f.totalTTC - totalPaid).toFixed(2));
        const storedReste = parseFloat((f.resteAPayer || 0).toFixed(2));

        if (Math.abs(storedReste - calculatedReste) > 0.01) {
            mismatchCount++;
            if (mismatchCount <= 20) {
                console.log(`[MISMATCH] Facture ${f.numero} (ID: ${f.id}): Stored=${storedReste}, Calculated=${calculatedReste}, Diff=${(storedReste - calculatedReste).toFixed(2)}`);
            }
        }
    }

    console.log(`\nTotal Factures checked: ${factures.length}`);
    console.log(`Total Mismatches detected: ${mismatchCount}`);

    await prisma.$disconnect();
}

run();
