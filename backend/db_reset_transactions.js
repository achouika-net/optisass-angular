
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
    console.log('🚀 Starting transactional data cleanup...');

    try {
        await prisma.$transaction([
            // Order matters due to foreign keys if they are not all onDelete: Cascade
            prisma.paiement.deleteMany(),
            prisma.pointsHistory.deleteMany(),
            prisma.mouvementStock.deleteMany(),
            // Facture is linked to Fiche and itself (parentFactureId)
            // To be safe with self-relations, we might need to null out parentFactureId first if not cascading
            prisma.facture.updateMany({ data: { parentFactureId: null, ficheId: null } }),
            prisma.facture.deleteMany(),
            prisma.fiche.deleteMany(),
        ]);

        console.log('✅ Transactional data successfully cleared.');
        console.log('Preserved tables: Clients, Products, Centers, Users, Groups, LoyaltyConfig.');
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanup();
