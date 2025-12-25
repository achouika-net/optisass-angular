const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clientId = '680711ed-5783-448d-8697-de34872bf779';

    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { pointsFidelite: true, nom: true }
    });
    console.log('--- Client ---');
    console.log(client);

    const history = await prisma.pointsHistory.findMany({
        where: { clientId },
        orderBy: { date: 'desc' }
    });
    console.log('\n--- History (' + history.length + ' entries) ---');
    history.forEach(h => {
        console.log(`[${h.type}] ${h.points} pts | ${h.date.toISOString()} | ${h.description}`);
    });

    const fiches = await prisma.fiche.findMany({
        where: { clientId },
        select: { id: true, createdAt: true, type: true }
    });
    console.log('\n--- Fiches (' + fiches.length + ' entries) ---');
    fiches.forEach(f => {
        console.log(`ID: ${f.id} | Created: ${f.createdAt.toISOString()} | Type: ${f.type}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
