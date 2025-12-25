const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clientId = '680711ed-5783-448d-8697-de34872bf779';

    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { pointsFidelite: true, nom: true }
    });
    console.log('Client:', client);

    const history = await prisma.pointsHistory.findMany({
        where: { clientId },
        orderBy: { date: 'desc' }
    });
    console.log('History:', JSON.stringify(history, null, 2));

    const fiches = await prisma.fiche.findMany({
        where: { clientId },
        select: { id: true, createdAt: true }
    });
    console.log('Fiches:', fiches);
}

main().finally(() => prisma.$disconnect());
