
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearTestData() {
    console.log('🚀 Starting Data Clearance for Retest...');

    try {
        // 1. Clear highly dependent entities first
        console.log('- Clearing Paiements, Commissions, Points, and Redemptions...');
        await prisma.paiement.deleteMany();
        await prisma.commission.deleteMany();
        await prisma.pointsHistory.deleteMany();
        await prisma.rewardRedemption.deleteMany();
        await prisma.demandeAlimentation.deleteMany();

        // 2. Clear entities that reference Facture/Fiche
        console.log('- Clearing OperationCaisses and MouvementsStock...');
        await prisma.operationCaisse.deleteMany();
        await prisma.mouvementStock.deleteMany();

        // Clear references in FactureFournisseur (nullable)
        await prisma.factureFournisseur.updateMany({
            data: { clientId: null, ficheId: null }
        });

        // 3. Clear Factures (which link Fiche and Client)
        console.log('- Clearing Factures...');
        await prisma.facture.deleteMany();

        // 4. Clear Fiches
        console.log('- Clearing Fiches...');
        await prisma.fiche.deleteMany();

        // 5. Clear Clients
        console.log('- Clearing Clients...');
        await prisma.client.deleteMany();

        console.log('✅ All test data (Clients, Fiches, Factures, Paiements) has been cleared.');
    } catch (error) {
        console.error('❌ Error during clearance:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

clearTestData();
