
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Statistics FactureFournisseur ---');
    const types = await prisma.factureFournisseur.groupBy({
        by: ['type'],
        _count: { id: true }
    });
    console.log('Types:', types);

    const centres = await prisma.factureFournisseur.groupBy({
        by: ['centreId'],
        _count: { id: true }
    });
    console.log('Centres:', centres);

    const recent = await prisma.factureFournisseur.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, numeroFacture: true, type: true, centreId: true, createdAt: true }
    });
    console.log('Most recent 10:', recent);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
