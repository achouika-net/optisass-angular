import { PrismaClient } from '@prisma/client';

async function findThe2843() {
    const prisma = new PrismaClient();

    console.log('--- Searching for FACTURE | BROUILLON across all centers ---');
    const records = await prisma.facture.groupBy({
        by: ['centreId', 'type', 'statut'],
        where: {
            OR: [
                { type: 'FACTURE' },
                { statut: 'BROUILLON' }
            ]
        },
        _count: true
    });
    console.log(JSON.stringify(records, null, 2));

    await prisma.$disconnect();
}

findThe2843();
