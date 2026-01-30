
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- DB PRODUCT CHECK ---');
    const count = await prisma.product.count();
    console.log('Total Products:', count);

    const products = await prisma.product.findMany({
        select: {
            id: true,
            designation: true,
            codeInterne: true,
            codeBarres: true,
            entrepotId: true
        }
    });

    products.forEach(p => {
        console.log(`- ${p.designation} | Ref: ${p.codeInterne} | Barcode: "${p.codeBarres}" | Warehouse: ${p.entrepotId}`);
    });

    // Check for duplicates that might exist if constraints weren't properly enforced or if we are about to create some
    const barcodeGroups = {};
    products.forEach(p => {
        const key = `${p.codeBarres}_${p.entrepotId}`;
        if (!barcodeGroups[key]) barcodeGroups[key] = [];
        barcodeGroups[key].push(p.id);
    });

    console.log('--- CONFLICT ANALYSIS ---');
    Object.keys(barcodeGroups).forEach(key => {
        if (barcodeGroups[key].length > 1) {
            console.log(`CONFLICT for Key [${key}]: IDs ${barcodeGroups[key].join(', ')}`);
        }
    });
}

run().catch(console.error).finally(() => prisma.$disconnect());
