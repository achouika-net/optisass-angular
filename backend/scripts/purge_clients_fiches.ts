import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Purging Clients and Fiches (and related transactional data)...');

    try {
        // 1. Order of deletion is important to satisfy foreign keys
        // TRUNCATE with CASCADE is the most efficient on PostgreSQL
        // This will clear: Paiement -> Facture -> Fiche -> Client (and others)

        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Paiement" CASCADE;`);
        console.log('✅ Paiement table cleared.');

        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "OperationCaisse" CASCADE;`);
        console.log('✅ OperationCaisse table cleared.');

        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Facture" CASCADE;`);
        console.log('✅ Facture table cleared.');

        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Fiche" CASCADE;`);
        console.log('✅ Fiche table cleared.');

        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "PointsHistory" CASCADE;`);
        console.log('✅ PointsHistory table cleared.');

        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "RewardRedemption" CASCADE;`);
        console.log('✅ RewardRedemption table cleared.');

        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Client" CASCADE;`);
        console.log('✅ Client table cleared (with all dependencies).');

        console.log('\n✨ Database is now clean for a new import.');
    } catch (error) {
        console.error('❌ Error during purge:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
