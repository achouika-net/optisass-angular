
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING FINAL CLEANUP ---');

    // 1. Find all FactureFournisseur IDs that have more than 1 EcheancePaiement
    const invoicesWithDupes = await prisma.$queryRaw<any[]>`
    SELECT "factureFournisseurId", COUNT(*) as count 
    FROM "EcheancePaiement" 
    WHERE "factureFournisseurId" IS NOT NULL 
    GROUP BY "factureFournisseurId" 
    HAVING COUNT(*) > 1
  `;

    console.log(`Found ${invoicesWithDupes.length} invoices with multiple echeances.`);

    for (const item of invoicesWithDupes) {
        const invoiceId = item.factureFournisseurId;
        const echeances = await prisma.echeancePaiement.findMany({
            where: { factureFournisseurId: invoiceId },
            orderBy: [
                { statut: 'desc' }, // PAYEE before EN_ATTENTE
                { createdAt: 'asc' }
            ]
        });

        if (echeances.length > 1) {
            // Keep the first one (most likely to be the correct paid one)
            const toKeep = echeances[0];
            const toDelete = echeances.slice(1);

            console.log(`Invoice ${invoiceId}: Keeping ${toKeep.id} (${toKeep.statut}), deleting ${toDelete.length} duplicates.`);

            for (const d of toDelete) {
                await prisma.echeancePaiement.delete({ where: { id: d.id } });
            }
        }
    }

    const finalTotal = await prisma.echeancePaiement.count();
    const invoices = await prisma.factureFournisseur.count();
    const expenses = await prisma.depense.count();

    console.log('--- FINAL STATE ---');
    console.log(`Factures: ${invoices}`);
    console.log(`Depenses: ${expenses}`);
    console.log(`Echeances: ${finalTotal}`);
    console.log(`Alignment: ${finalTotal === (invoices + expenses) ? 'PERFECT' : 'STILL MISALIGNED'}`);
}

main();
