import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function run() {
    console.log('Starting TTC fix for DEVIS / FACTURE...');
    const facs = await p.facture.findMany({
        where: { type: { in: ['DEVIS', 'FACTURE'] } },
        include: {
            fiche: { select: { montantTotal: true, montantPaye: true } },
            paiements: { select: { montant: true } }
        }
    });

    let updatedCount = 0;

    for (const f of facs) {
        if (!f.fiche) continue; // Skip if no fiche implies it wasn't inflated by import logic in the same way, or has no ground truth.

        // Ground truth is the imported Fiche's montantTotal
        const newTTC = f.fiche.montantTotal;
        if (newTTC === null || newTTC === undefined) continue;

        const newHT = newTTC / 1.20;
        const newTVA = newTTC - newHT;

        // Calculate new resteAPayer based on active paiements
        const pmtSum = f.paiements.reduce((sum, pm) => sum + pm.montant, 0);

        // If we have payments, reste is TTC - Paid
        let newReste = newTTC - pmtSum;
        if (newReste < 0) newReste = 0; // Prevent negative.

        // Optimization: check if it actually needs updating to prevent unnecessary DB writes
        if (Math.abs(f.totalTTC - newTTC) > 0.01 || Math.abs((f.resteAPayer || 0) - newReste) > 0.01) {
            await p.facture.update({
                where: { id: f.id },
                data: {
                    totalHT: newHT,
                    totalTVA: newTVA,
                    totalTTC: newTTC,
                    resteAPayer: newReste
                }
            });
            updatedCount++;
        }
    }

    console.log(`Updated ${updatedCount} factures to match true Fiche totalTTC.`);

    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
