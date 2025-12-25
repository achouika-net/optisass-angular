const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clientId = '680711ed-5783-448d-8697-de34872bf779';

    console.log('--- Client Data ---');
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, pointsFidelite: true, nom: true, raisonSociale: true }
    });
    console.log(client);

    console.log('\n--- Loyalty Config ---');
    const config = await prisma.loyaltyConfig.findFirst();
    console.log(config);

    console.log('\n--- Points History ---');
    const history = await prisma.pointsHistory.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' }
    });
    history.forEach(h => {
        console.log(`- [${h.createdAt.toISOString()}] ${h.type}: ${h.points} pts - ${h.description}`);
    });

    console.log('\n--- Fiches ---');
    const fiches = await prisma.fiche.findMany({
        where: { clientId },
        select: { id: true, createdAt: true, type: true }
    });
    fiches.forEach(f => {
        console.log(`- [${f.createdAt.toISOString()}] ${f.id} (${f.type})`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
