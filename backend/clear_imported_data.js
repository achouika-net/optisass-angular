import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearImportedData() {
    console.log('--- DELETING IMPORTED DATA FOR CLEAN RE-IMPORT ---');
    try {
        // Delete in order to respect Foreign Key constraints
        console.log('1. Deleting Paiements...');
        await prisma.paiement.deleteMany({});
        await prisma.echeancePaiement.deleteMany({});
        await prisma.depense.deleteMany({});

        console.log('2. Deleting Factures...');
        await prisma.facture.deleteMany({});
        await prisma.factureFournisseur.deleteMany({});

        console.log('3. Deleting Fiches & Movements...');
        await prisma.mouvementStock.deleteMany({});
        await prisma.fiche.deleteMany({});

        console.log('4. Deleting Clients & Fournisseurs...');
        await prisma.client.deleteMany({});
        await prisma.fournisseur.deleteMany({});

        console.log('--- DATA CLEARED SUCCESSFULLY ---');
    } catch (err) {
        console.error('Error clearing data:', err);
    } finally {
        await prisma.$disconnect();
    }
}

clearImportedData();
