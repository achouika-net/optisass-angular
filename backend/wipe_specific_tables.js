const { PrismaClient } = require('@prisma/client');

async function wipeSpecificTables() {
    console.log('--- WIPING SPECIFIC TABLES ON DOCKER DB (PORT 5435) ---');
    const url = 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public';
    const prisma = new PrismaClient({
        datasources: { db: { url } }
    });

    try {
        console.log('Executing TRUNCATE CASCADE on requested tables...');
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Depense" CASCADE;`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "FactureFournisseur" CASCADE;`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Fournisseur" CASCADE;`);

        console.log('--- TABLES SUCCESSFULLY EMPTIED ---');
    } catch (e) {
        console.error('Error wiping specific tables:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

wipeSpecificTables();
