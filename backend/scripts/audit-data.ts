
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- STATUT Groups ---');
    const statuses = await prisma.facture.groupBy({
        by: ['statut'],
        _count: { _all: true }
    });
    console.log(JSON.stringify(statuses, null, 2));

    console.log('\n--- TYPE Groups ---');
    const types = await prisma.facture.groupBy({
        by: ['type'],
        _count: { _all: true }
    });
    console.log(JSON.stringify(types, null, 2));

    console.log('\n--- Statuses for type FACTURE ---');
    const facturesByStatus = await prisma.facture.groupBy({
        by: ['statut'],
        where: { type: 'FACTURE' },
        _count: { _all: true }
    });
    console.log(JSON.stringify(facturesByStatus, null, 2));

    console.log('\n--- Numbers starting with FAC but type is not FACTURE ---');
    const mixed = await prisma.facture.count({
        where: {
            numero: { startsWith: 'FAC' },
            type: { not: 'FACTURE' }
        }
    });
    console.log('Count:', mixed);

    await prisma.$disconnect();
}

main();
