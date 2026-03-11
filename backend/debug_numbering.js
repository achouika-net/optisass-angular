const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const target = await prisma.facture.findFirst({
        where: { numero: 'BC-2026-10000' }
    });
    console.log('Target BC-2026-10000:', target);

    const others = await prisma.facture.findMany({
        where: { numero: { contains: '2026' } },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
    console.log('Recent 2026 documents:', others);
}

main().catch(console.error).finally(() => prisma.$disconnect());
