const { PrismaClient } = require('@prisma/client');

async function checkAndWipeDb(dbName) {
    console.log(`\n--- Checking DB: ${dbName} ---`);
    const url = `postgresql://postgres:admin@localhost:5432/${dbName}?schema=public`;
    const prisma = new PrismaClient({
        datasources: {
            db: { url }
        }
    });

    try {
        const clientCount = await prisma.client.count();
        const fichesCount = await prisma.fiche.count();
        const factureCount = await prisma.facture.count();

        console.log(`Clients: ${clientCount}, Fiches: ${fichesCount}, Factures: ${factureCount}`);

        if (fichesCount > 0) {
            console.log(`>> Wiping ${dbName}...`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Paiement" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "EcheancePaiement" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Depense" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Facture" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "FactureFournisseur" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "MouvementStock" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Fiche" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Client" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Fournisseur" CASCADE;`);
            console.log(`>> ${dbName} Wiped.`);
        }
    } catch (e) {
        console.error(`Error on ${dbName}:`, e.message);
    } finally {
        await prisma.$disconnect();
    }
}

async function run() {
    await checkAndWipeDb('optisaas');
    await checkAndWipeDb('optisass');
}

run();
