
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- WAREHOUSE AUDIT ---');
    const warehouses = await prisma.entrepot.findMany();
    console.log('Warehouses Found:', warehouses.length);
    warehouses.forEach(w => console.log(`- [${w.id}] ${w.nom} (Type: ${w.type}) (Centre: ${w.centreId})`));

    const wIds = warehouses.map(w => w.id);
    const products = await prisma.product.findMany({
        where: {
            entrepotId: { in: wIds }
        }
    });
    console.log('Products in Defective Warehouses:', products.length);

    if (products.length > 0) {
        console.log('Sample Products:');
        products.slice(0, 5).forEach(p => console.log(`  - ${p.designation} (${p.codeInterne}) Qty: ${p.quantiteActuelle}`));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
