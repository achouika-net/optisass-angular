const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        select: { id: true, numero: true, type: true, statut: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
    console.log(JSON.stringify(factures, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
