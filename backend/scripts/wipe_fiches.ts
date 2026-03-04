import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data wipe for Fiche, Facture, Paiement, PointsHistory...');

    // Using raw queries to TRUNCATE tables with CASCADE
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Paiement" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "PointsHistory" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Facture" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Fiche" CASCADE`);

    console.log('Tables truncated successfully.');

    // Reset loyalty points for clients
    await prisma.$executeRawUnsafe(`UPDATE "Client" SET "pointsFidelite" = 0`);
    console.log('Loyalty points reset to 0 for all clients.');

    console.log('Wipe completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
