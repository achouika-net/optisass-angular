
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- All FactureFournisseur ---');
    const fms = await prisma.factureFournisseur.findMany({
        select: {
            id: true,
            numeroFacture: true,
            centreId: true,
            createdAt: true,
            type: true
        },
        orderBy: { createdAt: 'desc' }
    });

    console.table(fms);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
