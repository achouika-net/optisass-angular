require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        where: { numero: { contains: '2026' } },
        select: { numero: true, createdAt: true, type: true },
        orderBy: { numero: 'asc' }
    });
    console.log('All 2026 documents (sorted by number):', factures);
}

main().catch(console.error).finally(() => prisma.$disconnect());
