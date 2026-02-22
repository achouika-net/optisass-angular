import { PrismaClient } from '@prisma/client';

async function checkDetailedDistribution() {
    const prisma = new PrismaClient();
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    console.log(`--- Detailed Distribution for Center: ${centreId} ---`);
    const counts = await prisma.facture.groupBy({
        where: { centreId },
        by: ['type', 'statut'],
        _count: true
    });
    console.log(JSON.stringify(counts, null, 2));

    await prisma.$disconnect();
}

checkDetailedDistribution();
