import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚮 Starting database cleanup...');

    // 1. Delete all Paiements
    const deletedPaiements = await prisma.paiement.deleteMany({});
    console.log(`✅ Deleted ${deletedPaiements.count} paiements.`);

    // 2. Delete all Factures
    const deletedFactures = await prisma.facture.deleteMany({});
    console.log(`✅ Deleted ${deletedFactures.count} factures.`);

    // 3. Delete all Fiches
    const deletedFiches = await prisma.fiche.deleteMany({});
    console.log(`✅ Deleted ${deletedFiches.count} fiches.`);

    console.log('✨ Tables are now empty. You can proceed with the re-import.');
}

main()
    .catch((e) => {
        console.error('❌ Error during cleanup:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
