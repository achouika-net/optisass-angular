const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const factures = await prisma.facture.findMany({
        include: { paiements: true }
    });

    console.log(`Starting balance fix for ${factures.length} documents...`);
    let fixedCount = 0;

    for (const f of factures) {
        const totalPaid = f.paiements.reduce((sum, p) => sum + p.montant, 0);
        const calculatedReste = parseFloat(Math.max(0, f.totalTTC - totalPaid).toFixed(2));
        const storedReste = parseFloat((f.resteAPayer || 0).toFixed(2));

        if (Math.abs(storedReste - calculatedReste) > 0.01) {
            await prisma.facture.update({
                where: { id: f.id },
                data: { resteAPayer: calculatedReste }
            });
            fixedCount++;
            if (fixedCount % 50 === 0) {
                console.log(`Progress: Fixed ${fixedCount} documents...`);
            }
        }
    }

    console.log(`\nFinished! Corrected ${fixedCount} balance mismatches.`);
    await prisma.$disconnect();
}

run();
