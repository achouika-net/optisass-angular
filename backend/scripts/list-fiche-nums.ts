import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const fiches = await prisma.fiche.findMany({
        select: { numero: true },
        orderBy: { numero: 'asc' },
        take: 20
    });

    console.log('Fiche numbers (first 20):', fiches.map(f => f.numero));

    const highFiches = await prisma.fiche.findMany({
        select: { numero: true },
        orderBy: { numero: 'desc' },
        take: 20
    });

    console.log('Fiche numbers (last 20):', highFiches.map(f => f.numero).reverse());
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
