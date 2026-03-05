import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    console.log('🚀 Starting COMPREHENSIVE database wipe (TRUNCATE CASCADE)...');

    const tables = [
        'Paiement',
        'EcheancePaiement',
        'Facture',
        'FactureFournisseur',
        'BonLivraison',
        'MouvementStock',
        'Depense',
        'Fiche',
        'RewardRedemption',
        'PointsHistory',
    ];

    try {
        for (const table of tables) {
            console.log(`Clearing table: ${table}...`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
        }
        console.log('✅ Database wiped successfully.');
    } catch (error) {
        console.error('❌ Error wiping database:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
