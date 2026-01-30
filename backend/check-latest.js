
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- ABSOLUTE LATEST ENTRIES ---');

    const invoices = await prisma.factureFournisseur.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { fournisseur: true }
    });
    console.log('LATEST INVOICES:');
    invoices.forEach(inv => {
        console.log(`- ID: ${inv.id}, Num: ${inv.numeroFacture}, Created: ${inv.createdAt.toISOString()}, Supplier: ${inv.fournisseur?.nom}, Center: ${inv.centreId}`);
    });

    const movements = await prisma.mouvementStock.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { produit: true }
    });
    console.log('LATEST MOVEMENTS:');
    movements.forEach(m => {
        console.log(`- ID: ${m.id}, Type: ${m.type}, Qty: ${m.quantite}, Product: ${m.produit?.designation}, Created: ${m.createdAt.toISOString()}`);
    });
}

run().catch(console.error).finally(() => prisma.$disconnect());
