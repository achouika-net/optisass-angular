
const { PrismaClient } = require('@prisma/client');
const url = 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public';
const prisma = new PrismaClient({
    datasources: { db: { url } }
});

async function clean() {
    console.log('--- CLEARING DOCKER DB (5435) ---');
    try {
        // Correct order for constraints
        console.log('Deleting from EcheancePaiement...');
        await prisma.echeancePaiement.deleteMany();

        console.log('Deleting from Depense...');
        await prisma.depense.deleteMany();

        console.log('Deleting from FactureFournisseur...');
        await prisma.factureFournisseur.deleteMany();

        console.log('--- DOCKER DB (5435) IS NOW EMPTY ---');
    } catch (e) {
        console.error('Error during cleanup:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

clean();
