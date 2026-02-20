
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Clearing Paiement tables...');

    try {
        // 1. Delete all Paiements
        const deletePaiements = await prisma.paiement.deleteMany();
        console.log(`✅ Deleted ${deletePaiements.count} client payments.`);

        // 2. Reset Facture balances
        const updateFactures = await prisma.facture.updateMany({
            data: {
                resteAPayer: { set: 0 }, // We will set it to totalTTC in next step individually since updateMany doesn't support field references
                statut: 'VALIDEE'
            }
        });

        // Since updateMany doesn't allow setting a field to another field's value, 
        // we need to do it via a raw query or loop for accuracy.
        await prisma.$executeRawUnsafe(`UPDATE "Facture" SET "resteAPayer" = "totalTTC", "statut" = 'VALIDEE'`);
        console.log(`✅ Reset all Facture balances and statuses.`);

        // 3. Clear OperationCaisse if they were payments
        const deleteOps = await prisma.operationCaisse.deleteMany({
            where: { typeOperation: 'COMPTABLE' } // Usually payments
        });
        console.log(`✅ Deleted ${deleteOps.count} accounting operations from Caisse.`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
