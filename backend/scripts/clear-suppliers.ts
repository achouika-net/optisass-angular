
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Supplier & Invoice cleanup...');

    try {
        // 1. Handle MouvementStock links to FactureFournisseur
        // We nullify the reference instead of deleting the movement, just in case.
        // But if they were created by import, maybe we should delete?
        // Let's nullify to be safe.
        const updateMouvements = await prisma.mouvementStock.updateMany({
            where: { factureFournisseurId: { not: null } },
            data: { factureFournisseurId: null }
        });
        console.log(`✅ Nullified FactureFournisseur links in ${updateMouvements.count} MouvementStock records.`);

        // 2. Clear Depense (Expenses)
        // Some are linked to FactureFournisseur, others directly to Fournisseur.
        // We'll clear all to ensure a fresh start for the finance section.
        const deleteDepenses = await prisma.depense.deleteMany();
        console.log(`✅ Deleted ${deleteDepenses.count} Depense records.`);

        // 3. Clear EcheancePaiement (Payment installments for suppliers)
        const deleteEcheances = await prisma.echeancePaiement.deleteMany();
        console.log(`✅ Deleted ${deleteEcheances.count} EcheancePaiement records.`);

        // 4. Clear FactureFournisseur (Supplier Invoiced/BLs)
        const deleteInvoices = await prisma.factureFournisseur.deleteMany();
        console.log(`✅ Deleted ${deleteInvoices.count} FactureFournisseur records.`);

        // 5. Clear Fournisseur (Suppliers)
        const deleteSuppliers = await prisma.fournisseur.deleteMany();
        console.log(`✅ Deleted ${deleteSuppliers.count} Fournisseur records.`);

        console.log('✨ Cleanup complete. Database is ready for re-import.');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
