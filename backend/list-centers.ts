import { PrismaClient } from '@prisma/client';

async function listCenters() {
    const prisma = new PrismaClient();

    console.log('--- Centers and their Facture Counts ---');
    const centers = await prisma.centre.findMany({
        select: { id: true, nom: true }
    });

    for (const c of centers) {
        const count = await prisma.facture.count({ where: { centreId: c.id } });
        console.log(`${c.nom} (${c.id}): ${count} factures`);
    }

    await prisma.$disconnect();
}

listCenters();
