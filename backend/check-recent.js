
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    console.log('--- RECENT ACTIVITY (Since ' + thirtyMinsAgo.toISOString() + ') ---');

    const invoices = await prisma.factureFournisseur.findMany({
        where: { createdAt: { gte: thirtyMinsAgo } },
        include: { fournisseur: true, mouvementsStock: true }
    });
    console.log('RECENT INVOICES:', invoices.length);
    invoices.forEach(inv => {
        console.log(`- Invoice ${inv.numeroFacture}, Center: ${inv.centreId}, Supplier: ${inv.fournisseur?.nom}`);
    });

    const movements = await prisma.mouvementStock.findMany({
        where: { createdAt: { gte: thirtyMinsAgo } },
        include: { produit: true, entrepotDestination: true }
    });
    console.log('RECENT MOVEMENTS:', movements.length);
    movements.forEach(m => {
        console.log(`- Movement: ${m.type}, Qty: ${m.quantite}, Product: ${m.produit?.designation}, Warehouse: ${m.entrepotDestination?.nom} (Center: ${m.entrepotDestination?.centreId})`);
    });

    const products = await prisma.product.findMany({
        where: { createdAt: { gte: thirtyMinsAgo } },
        include: { entrepot: true }
    });
    console.log('NEW PRODUCTS:', products.length);
    products.forEach(p => {
        console.log(`- Product: ${p.designation}, Ref: ${p.codeInterne}, Warehouse: ${p.entrepot?.nom}`);
    });
}

run().catch(console.error).finally(() => prisma.$disconnect());
