const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const clients = await prisma.client.findMany({
        where: { pointsFidelite: { gt: 0 } },
        select: { id: true, nom: true, prenom: true, pointsFidelite: true }
    });
    console.log('Clients with points:', clients.length);

    const targetClient = await prisma.client.findFirst({
        where: { nom: { contains: 'MOUTTAQUI' } },
        select: { id: true, nom: true, prenom: true, pointsFidelite: true }
    });
    console.log('Target Client:', targetClient);

    const config = await prisma.loyaltyConfig.findFirst();
    console.log('Loyalty Config:', config);
}
run().finally(() => prisma.$disconnect());
