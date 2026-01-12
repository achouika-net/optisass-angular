
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Diagnostic Storage History ---');
    const total = await prisma.factureFournisseur.count();
    const withCentre = await prisma.factureFournisseur.count({ where: { NOT: { centreId: null } } });
    const withoutCentre = await prisma.factureFournisseur.count({ where: { centreId: null } });

    console.log('Total FactureFournisseur:', total);
    console.log('With Centre:', withCentre);
    console.log('Without Centre:', withoutCentre);

    if (total > 0) {
        const samples = await prisma.factureFournisseur.findMany({ take: 5, select: { id: true, centreId: true, type: true } });
        console.log('Samples:', JSON.stringify(samples, null, 2));
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
