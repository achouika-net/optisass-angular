import { PrismaClient } from '@prisma/client';
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Targeted Cleanup: Clearing Purchase Invoices (BL) and Supplier Expenses...');

    try {
        // 1. Delete MouvementsStock linked to supplier invoices
        const movements = await prisma.mouvementStock.deleteMany({
            where: { factureFournisseurId: { not: null } }
        });
        console.log(`  ✓ Deleted ${movements.count} MouvementStock records.`);

        // 2. Delete Depense linked to FactureFournisseur (these will cascade or be handled)
        // We also want to delete standalone supplier expenses created during import
        const depenses = await prisma.depense.deleteMany({
            where: {
                OR: [
                    { factureFournisseurId: { not: null } },
                    { description: { contains: 'Achat sans facture (Fournisseur:' } }
                ]
            }
        });
        console.log(`  ✓ Deleted ${depenses.count} Depense records (Purchase related).`);

        // 3. Delete FactureFournisseur (Purchase Invoices / BLs)
        // This should cascade to EcheancePaiement because of 'onDelete: Cascade' in schema
        const invoices = await prisma.factureFournisseur.deleteMany({});
        console.log(`  ✓ Deleted ${invoices.count} FactureFournisseur records (BLs/Invoices).`);

        // 4. Final Cleanup for orphaned EcheancePaiement 
        // (Just in case some weren't linked correctly)
        const echeances = await prisma.echeancePaiement.deleteMany({
            where: {
                AND: [
                    { factureFournisseurId: null },
                    { depense: null } // This might be tricky in Prisma, let's just delete where type matches purchase synonyms if any
                ]
            }
        });
        // Actually, just deleting FactureFournisseur cascades to its Echeances.
        // Standalone expenses echeances are harder to target without risk.

        console.log('\n✅ Purchase data cleared successfully!');

        // Stats
        const invoicesCount = await prisma.factureFournisseur.count();
        const depenseCount = await prisma.depense.count();
        const echeanceCount = await prisma.echeancePaiement.count();

        console.log('\n📊 Database state after cleanup:');
        console.log(`   FactureFournisseur: ${invoicesCount}`);
        console.log(`   Depense:            ${depenseCount}`);
        console.log(`   EcheancePaiement:   ${echeanceCount}`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
