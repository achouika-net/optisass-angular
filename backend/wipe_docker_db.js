const { PrismaClient } = require('@prisma/client');

async function wipeDockerDb() {
    console.log('--- CHECKING DOCKER DATABASE ON PORT 5435 ---');
    const url = 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public';
    const prisma = new PrismaClient({
        datasources: { db: { url } }
    });

    try {
        const clientCount = await prisma.client.count();
        const fichesCount = await prisma.fiche.count();
        console.log(`Pre-Wipe Counts -> Clients: ${clientCount}, Fiches: ${fichesCount}`);

        if (clientCount > 0 || fichesCount > 0) {
            console.log('Executing TRUNCATE CASCADE...');
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Paiement" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "EcheancePaiement" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Depense" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Facture" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "FactureFournisseur" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "MouvementStock" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Fiche" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Client" CASCADE;`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Fournisseur" CASCADE;`);
            console.log('--- TABLES ON DOCKER DB TRUNCATED ---');
        } else {
            console.log('Docker DB is already empty.');
        }
    } catch (e) {
        console.error('Error connecting/wiping Docker DB:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

wipeDockerDb();
