const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        console.log('Running findMany on Facture...');
        const expiredDrafts = await prisma.facture.findMany({
            where: {
                statut: 'BROUILLON',
                dateEmission: { lt: twoMonthsAgo },
                paiements: { none: {} }
            }
        });

        console.log(`Success! Found ${expiredDrafts.length} drafts.`);
    } catch (e) {
        console.error('Error during reproduction:');
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
