import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function truncateImportedData() {
    console.log('--- EXECUTING RAW SQL TRUNCATE FOR CLEAN RE-IMPORT ---');
    try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Paiement" CASCADE;`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "EcheancePaiement" CASCADE;`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Depense" CASCADE;`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Facture" CASCADE;`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "FactureFournisseur" CASCADE;`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "MouvementStock" CASCADE;`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Fiche" CASCADE;`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Client" CASCADE;`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Fournisseur" CASCADE;`);
        console.log('--- TABLES TRUNCATED SUCCESSFULLY ---');

        // Let's count to verify
        const clientCount = await prisma.client.count();
        const fichesCount = await prisma.fiche.count();
        console.log(`Current Clients Count: ${clientCount}`);
        console.log(`Current Fiches Count: ${fichesCount}`);

    } catch (err) {
        console.error('Error truncating data:', err);
    } finally {
        await prisma.$disconnect();
    }
}

truncateImportedData();
