const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        where: { type: { in: ['BON_COMM', 'BON_COMMANDE', 'FACTURE'] } },
        select: { id: true, numero: true, proprietes: true, updatedAt: true },
        take: 5,
        orderBy: { updatedAt: 'desc' }
    });
    factures.forEach(f => {
        const p = f.proprietes;
        console.log(`${f.numero} | pointsUtilises: ${p?.pointsUtilises || 'N/A'} | pointsSpent: ${p?.pointsSpent || false}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
