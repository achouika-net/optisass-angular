import { PrismaClient } from '@prisma/client';
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Import Data Reset: Clients, Fiches, Factures, Paiements...');
    console.log('⚠️  Centres, Groupes, Users, Employees and Caisses are PRESERVED');
    console.log('   (so your session stays valid after the reset)');

    try {
        // 1. Transactions & Dependent records
        await prisma.demandeAlimentation.deleteMany({});
        console.log('  ✓ DemandesAlimentation');
        await prisma.paiement.deleteMany({});
        console.log('  ✓ Paiements');
        await prisma.commission.deleteMany({});
        console.log('  ✓ Commissions');
        await prisma.mouvementStock.deleteMany({});
        console.log('  ✓ MouvementsStock');
        await prisma.pointsHistory.deleteMany({});
        console.log('  ✓ PointsHistory');
        await prisma.rewardRedemption.deleteMany({});
        console.log('  ✓ RewardRedemptions');

        // 2. Documents & Financial Records
        await prisma.echeancePaiement.deleteMany({});
        console.log('  ✓ EcheancesPaiement');
        await prisma.depense.deleteMany({});
        console.log('  ✓ Depenses');
        await prisma.facture.deleteMany({});
        console.log('  ✓ Factures');
        await prisma.factureFournisseur.deleteMany({});
        console.log('  ✓ FacturesFournisseur');
        await prisma.fiche.deleteMany({});
        console.log('  ✓ Fiches');

        // 3. Clients and Suppliers (imported data)
        await prisma.client.deleteMany({});
        console.log('  ✓ Clients');
        await prisma.fournisseur.deleteMany({});
        console.log('  ✓ Fournisseurs');

        // NOTE: We do NOT delete:
        // - Centre (sessions reference centreId from JWT)
        // - Groupe (referenced by Centre)
        // - User / Employee (authentication)
        // - Caisse / JourneeCaisse (operational config)
        // - Payroll, Attendance (HR data)

        console.log('\n✅ Import data cleared successfully!');

        // Final Count
        const clientCount = await prisma.client.count();
        const ficheCount = await prisma.fiche.count();
        const factureCount = await prisma.facture.count();
        const centreCount = await prisma.centre.count();
        const caisseCount = await prisma.caisse.count();

        console.log('\n📊 Final State:');
        console.log(`   Clients:        ${clientCount}  (should be 0)`);
        console.log(`   Fiches:         ${ficheCount}  (should be 0)`);
        console.log(`   Factures:       ${factureCount}  (should be 0)`);
        console.log(`   Centres:        ${centreCount}  (preserved ✓)`);
        console.log(`   Caisses:        ${caisseCount}  (preserved ✓)`);
        console.log('\n✨ Ready for fresh import. Your session and caisses are intact.');
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
