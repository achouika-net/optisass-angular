import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Clearing Client, Fiche and Facture Data ---');

    try {
        // Order of deletion to respect foreign keys:
        // 1. Paiement (linked to Facture)
        // 2. Facture (linked to Fiche or Client)
        // 3. Fiche (linked to Client)
        // 4. Client

        console.log('Deleting Paiement...');
        await prisma.paiement.deleteMany({});

        console.log('Deleting Operations Caisse (linked to Factures)...');
        await prisma.operationCaisse.deleteMany({});

        console.log('Deleting Facture...');
        await prisma.facture.deleteMany({});

        console.log('Deleting Fiche...');
        await prisma.fiche.deleteMany({});

        console.log('Deleting Client...');
        await prisma.client.deleteMany({});

        console.log('\n--- Verification ---');
        const countClients = await prisma.client.count();
        const countFiches = await prisma.fiche.count();
        const countFactures = await prisma.facture.count();
        const countPaiements = await prisma.paiement.count();

        console.log(`Remaining Clients: ${countClients}`);
        console.log(`Remaining Fiches: ${countFiches}`);
        console.log(`Remaining Factures: ${countFactures}`);
        console.log(`Remaining Paiements: ${countPaiements}`);

        console.log('\n✅ Cleanup complete.');
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
