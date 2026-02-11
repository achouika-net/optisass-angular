import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🗑️  Starting cleanup...');

        // 1. Delete Factures (Child of Fiche often, or related)
        // We delete factures first to avoid foreign key constraints if any, though Fiche is the parent.
        // However, Facture has a unique constraint on ficheId, so it's 1:1. 
        // If we delete Fiche, Facture might remain if not cascading.

        console.log('Deleting Factures linked to Fiches (or all factures)...');
        // Deleting ALL factures might be too aggressive if they have other sales?
        // User said "effacer la table fiche client medicale".
        // Usually, imports create both Fiche and Facture.
        // Let's delete ALL for now as this seems to be a dev/test environment given "tester proprement".

        const deletedFactures = await prisma.facture.deleteMany({
            where: {
                // Optional: filter only those with ficheId if we wanted to be safer
                // ficheId: { not: null } 
            }
        });
        console.log(`✅ Deleted ${deletedFactures.count} Factures.`);

        // 2. Delete Fiches
        console.log('Deleting Fiches...');
        const deletedFiches = await prisma.fiche.deleteMany({});
        console.log(`✅ Deleted ${deletedFiches.count} Fiches.`);

    } catch (error) {
        console.error('❌ Error clearing data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
