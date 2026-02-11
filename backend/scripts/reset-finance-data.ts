import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Starting Complete Finance Data Reset ---');

    try {
        // 1. Delete Depenses (points to EcheancePaiement and FactureFournisseur)
        const deletedDepenses = await prisma.depense.deleteMany({});
        console.log(`- Deleted ${deletedDepenses.count} expenses (Depense)`);

        // 2. Delete EcheancePaiement (points to FactureFournisseur)
        const deletedEcheances = await prisma.echeancePaiement.deleteMany({});
        console.log(`- Deleted ${deletedEcheances.count} payment installments (EcheancePaiement)`);

        // 3. Delete FactureFournisseur
        const deletedFactures = await prisma.factureFournisseur.deleteMany({});
        console.log(`- Deleted ${deletedFactures.count} supplier invoices (FactureFournisseur)`);

        console.log('--- Reset Complete ---');
    } catch (error) {
        console.error('Error during reset:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
