import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function main() {
    console.log('Cleaning up supplier-related data...');

    try {
        // Orders matter due to foreign key constraints if not using cascade in Prisma $executeRaw
        // However, FactureFournisseur has relations that might need careful deletion.

        // 1. Delete MouvementsStock linked to supplier invoices
        const movements = await prisma.mouvementStock.deleteMany({
            where: { factureFournisseurId: { not: null } }
        });
        console.log(`Deleted ${movements.count} MouvementStock records.`);

        // 2. Delete EcheancePaiement
        const echeances = await prisma.echeancePaiement.deleteMany({});
        console.log(`Deleted ${echeances.count} EcheancePaiement records.`);

        // 3. Delete ALL Depense records
        const depensesTotal = await prisma.depense.deleteMany({});
        console.log(`Deleted ${depensesTotal.count} Depense records.`);

        // 4. Delete FactureFournisseur
        const invoices = await prisma.factureFournisseur.deleteMany({});
        console.log(`Deleted ${invoices.count} FactureFournisseur records.`);

        // 5. Delete Fournisseur
        const suppliers = await prisma.fournisseur.deleteMany({});
        console.log(`Deleted ${suppliers.count} Fournisseur records.`);

        console.log('Cleanup complete.');
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
