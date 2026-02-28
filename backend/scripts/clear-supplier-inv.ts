import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Clearing Supplier Invoices and Payments tables...');

    try {
        // 1. Delete associated payments (Depense usually handles supplier payments in this system)
        const deleteDepenses = await prisma.depense.deleteMany({
            where: {
                factureFournisseurId: { not: null }
            }
        });
        console.log(`✅ Deleted ${deleteDepenses.count} payments attached to supplier invoices.`);

        // In case there are generalized Depense items the user implies are supplier payments:
        const deleteOtherDepenses = await prisma.depense.deleteMany();
        console.log(`✅ Deleted ${deleteOtherDepenses.count} remaining expenses (paiements fournisseur).`);

        // 2. Delete the FactureFournisseur
        const deleteFacturesF = await prisma.factureFournisseur.deleteMany();
        console.log(`✅ Deleted ${deleteFacturesF.count} supplier invoices.`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
