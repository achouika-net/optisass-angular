
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting defective stock cleanup...');

    // 1. Find defective warehouses
    const defectiveWarehouses = await prisma.entrepot.findMany({
        where: {
            nom: { contains: 'defect', mode: 'insensitive' }
        }
    });

    const wIds = defectiveWarehouses.map(w => w.id);
    console.log(`Found ${defectiveWarehouses.length} defective warehouses: ${defectiveWarehouses.map(w => w.nom).join(', ')}`);

    if (wIds.length === 0) {
        console.log('No defective warehouses found. Checking products with "(Défectueux)" in designation...');
        const defectiveProducts = await prisma.product.findMany({
            where: {
                designation: { contains: '(Défectueux)', mode: 'insensitive' }
            }
        });
        console.log(`Found ${defectiveProducts.length} products to clear.`);
        if (defectiveProducts.length > 0) {
            const result = await prisma.product.deleteMany({
                where: { id: { in: defectiveProducts.map(p => p.id) } }
            });
            console.log(`Deleted ${result.count} defective products.`);
        }
        return;
    }

    // 2. Clear products in these warehouses
    const result = await prisma.product.deleteMany({
        where: {
            entrepotId: { in: wIds }
        }
    });

    console.log(`✅ Deleted ${result.count} products from defective warehouses.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
