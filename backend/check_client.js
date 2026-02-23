const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const targetClient = await prisma.client.findFirst({ where: { nom: { contains: 'MOUTTAQUI' } } });
    if (targetClient) {
        const factures = await prisma.facture.findMany({ where: { clientId: targetClient.id } });
        console.log('Factures:', factures.map(f => ({ id: f.id, numero: f.numero, type: f.type, statut: f.statut, totalTTC: f.totalTTC, date: f.dateEmission })));

        // Check points history
        const ph = await prisma.pointsHistory.findMany({ where: { clientId: targetClient.id } });
        console.log('Points History:', ph);
    } else {
        console.log('No client found');
    }
}
run().finally(() => prisma.$disconnect());
