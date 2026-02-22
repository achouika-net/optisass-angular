const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- Database Balance Synchronization ---');

    // Fetch all factures and their payments across the whole system
    const factures = await prisma.facture.findMany({
        include: { paiements: true }
    });

    console.log(`Analyzing ${factures.length} documents...`);
    let fixedCount = 0;
    let totalFixedAmount = 0;

    for (const f of factures) {
        const totalPaid = f.paiements.reduce((sum, p) => sum + p.montant, 0);

        // We allow resteAPayer to be negative (representing a credit/overpayment)
        // to ensure mathematical consistency: TotalTTC - TotalPaid
        const calculatedReste = parseFloat((f.totalTTC - totalPaid).toFixed(2));
        const storedReste = parseFloat((f.resteAPayer || 0).toFixed(2));

        if (Math.abs(storedReste - calculatedReste) > 0.001) {
            await prisma.facture.update({
                where: { id: f.id },
                data: { resteAPayer: calculatedReste }
            });
            fixedCount++;
            totalFixedAmount += Math.abs(storedReste - calculatedReste);
        }
    }

    console.log(`\nSynchronization Complete!`);
    console.log(`Fixed: ${fixedCount} documents.`);
    console.log(`Total balance adjustment sum: ${totalFixedAmount.toFixed(2)} DH`);

    await prisma.$disconnect();
}

run();
