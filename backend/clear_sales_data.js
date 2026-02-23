const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    console.log('🗑  VIDAGE DES DONNÉES CLIENTS/FICHES/FACTURES/PAIEMENTS\n');

    // Count before
    const beforeClients = await p.client.count();
    const beforeFiches = await p.fiche.count();
    const beforeFactures = await p.facture.count();
    const beforePaie = await p.paiement.count();
    const beforePoints = await p.pointsHistory.count();
    const beforeRewards = await p.rewardRedemption.count();

    console.log('📊 Avant vidage :');
    console.log(`   Clients        : ${beforeClients}`);
    console.log(`   Fiches         : ${beforeFiches}`);
    console.log(`   Factures       : ${beforeFactures}`);
    console.log(`   Paiements      : ${beforePaie}`);
    console.log(`   PointsHistory  : ${beforePoints}`);
    console.log(`   RewardRedemption: ${beforeRewards}`);

    console.log('\n🔄 Suppression en cours (ordre FK)...');

    // 1. Tables dépendantes en premier
    const d1 = await p.pointsHistory.deleteMany({});
    console.log(`   ✅ PointsHistory supprimés   : ${d1.count}`);

    const d2 = await p.rewardRedemption.deleteMany({});
    console.log(`   ✅ RewardRedemption supprimés : ${d2.count}`);

    const d3 = await p.paiement.deleteMany({});
    console.log(`   ✅ Paiements supprimés        : ${d3.count}`);

    const d4 = await p.fiche.deleteMany({});
    console.log(`   ✅ Fiches supprimées          : ${d4.count}`);

    const d5 = await p.facture.deleteMany({});
    console.log(`   ✅ Factures supprimées        : ${d5.count}`);

    const d6 = await p.client.deleteMany({});
    console.log(`   ✅ Clients supprimés          : ${d6.count}`);

    // Verify
    const afterClients = await p.client.count();
    const afterFiches = await p.fiche.count();
    const afterFactures = await p.facture.count();
    const afterPaie = await p.paiement.count();

    console.log('\n📊 Après vidage :');
    console.log(`   Clients   : ${afterClients}`);
    console.log(`   Fiches    : ${afterFiches}`);
    console.log(`   Factures  : ${afterFactures}`);
    console.log(`   Paiements : ${afterPaie}`);
    console.log('\n✅ Base prête pour la réimportation.');
}

run().finally(() => p.$disconnect());
