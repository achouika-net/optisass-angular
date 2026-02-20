
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        select: { type: true, statut: true }
    });

    const typeStats = {};
    const statutStats = {};

    factures.forEach(f => {
        typeStats[f.type] = (typeStats[f.type] || 0) + 1;
        statutStats[f.statut] = (statutStats[f.statut] || 0) + 1;
    });

    console.log('Types:', JSON.stringify(typeStats, null, 2));
    console.log('Statuts:', JSON.stringify(statutStats, null, 2));

    await prisma.$disconnect();
}

main();
