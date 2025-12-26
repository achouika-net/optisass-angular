const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetDatabase() {
    console.log('🧹 Starting database reset...\n');

    try {
        // Delete in correct order to respect foreign key constraints

        console.log('📋 Deleting Points History...');
        const pointsHistory = await prisma.pointsHistory.deleteMany({});
        console.log(`   ✓ Deleted ${pointsHistory.count} records`);

        console.log('🎁 Deleting Reward Redemptions...');
        const rewards = await prisma.rewardRedemption.deleteMany({});
        console.log(`   ✓ Deleted ${rewards.count} records`);

        console.log('📦 Deleting Stock Movements...');
        const stockMovements = await prisma.mouvementStock.deleteMany({});
        console.log(`   ✓ Deleted ${stockMovements.count} records`);

        console.log('💰 Deleting Client Payments...');
        const paiements = await prisma.paiement.deleteMany({});
        console.log(`   ✓ Deleted ${paiements.count} records`);

        console.log('📄 Deleting Invoices...');
        const factures = await prisma.facture.deleteMany({});
        console.log(`   ✓ Deleted ${factures.count} records`);

        console.log('📋 Deleting Fiches...');
        const fiches = await prisma.fiche.deleteMany({});
        console.log(`   ✓ Deleted ${fiches.count} records`);

        console.log('👥 Deleting Clients...');
        const clients = await prisma.client.deleteMany({});
        console.log(`   ✓ Deleted ${clients.count} records`);

        console.log('💸 Deleting Supplier Invoice Payment Schedules...');
        const echeances = await prisma.echeancePaiement.deleteMany({});
        console.log(`   ✓ Deleted ${echeances.count} records`);

        console.log('📑 Deleting Supplier Invoices...');
        const facturesFournisseurs = await prisma.factureFournisseur.deleteMany({});
        console.log(`   ✓ Deleted ${facturesFournisseurs.count} records`);

        console.log('💵 Deleting Expenses...');
        const depenses = await prisma.depense.deleteMany({});
        console.log(`   ✓ Deleted ${depenses.count} records`);

        console.log('📦 Deleting Products...');
        const produits = await prisma.produit.deleteMany({});
        console.log(`   ✓ Deleted ${produits.count} records`);

        console.log('\n✅ Database reset completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Clients: ${clients.count}`);
        console.log(`   - Fiches: ${fiches.count}`);
        console.log(`   - Factures: ${factures.count}`);
        console.log(`   - Paiements: ${paiements.count}`);
        console.log(`   - Dépenses: ${depenses.count}`);
        console.log(`   - Factures Fournisseurs: ${facturesFournisseurs.count}`);
        console.log(`   - Échéances: ${echeances.count}`);
        console.log(`   - Produits: ${produits.count}`);
        console.log(`   - Mouvements Stock: ${stockMovements.count}`);
        console.log(`   - Points History: ${pointsHistory.count}`);
        console.log(`   - Reward Redemptions: ${rewards.count}`);
        console.log('\n🔒 Preserved:');
        console.log('   - Groupes');
        console.log('   - Centres');
        console.log('   - Entrepôts');
        console.log('   - Utilisateurs');
        console.log('   - Fournisseurs');
        console.log('   - Configuration Finance');
        console.log('   - Configuration Loyalty');

    } catch (error) {
        console.error('❌ Error during database reset:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the reset
resetDatabase()
    .then(() => {
        console.log('\n✨ Ready for fresh testing!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Reset failed:', error);
        process.exit(1);
    });
