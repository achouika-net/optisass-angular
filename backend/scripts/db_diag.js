
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- DATABASE DIAGNOSTIC ---');
    try {
        const counts = {
            FactureFournisseur: await prisma.factureFournisseur.count(),
            Depense: await prisma.depense.count(),
            EcheancePaiement: await prisma.echeancePaiement.count(),
            Paiement: await prisma.paiement.count(),
        };
        console.log('Current Counts:', JSON.stringify(counts, null, 2));

        // Check most recent entries to see if they were just created
        const lastFF = await prisma.factureFournisseur.findFirst({ orderBy: { id: 'desc' } });
        console.log('Last FactureFournisseur ID:', lastFF ? lastFF.id : 'NONE');
    } catch (e) {
        console.error('Diagnostic error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
