
const { PrismaClient } = require('@prisma/client');
const url = 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public';
const prisma = new PrismaClient({
    datasources: { db: { url } }
});

async function check() {
    console.log('--- DOCKER DB DIAGNOSTIC (5435) ---');
    try {
        const counts = {
            FactureFournisseur: await prisma.factureFournisseur.count(),
            Depense: await prisma.depense.count(),
            EcheancePaiement: await prisma.echeancePaiement.count(),
        };
        console.log('Docker Counts:', JSON.stringify(counts, null, 2));
    } catch (e) {
        console.error('Diagnostic error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
