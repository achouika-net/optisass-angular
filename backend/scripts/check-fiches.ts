import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const fiches = await prisma.fiche.findMany({
        take: 10,
        orderBy: { numero: 'asc' }
    });

    const count = await prisma.fiche.count();

    console.log(`Total Fiches in DB: ${count}`);
    console.log('Sample Fiches:', JSON.stringify(fiches, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
