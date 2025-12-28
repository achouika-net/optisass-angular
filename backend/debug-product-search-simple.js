
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function findProduct() {
    try {
        console.log('Searching for products...');
        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { name: { contains: 'Ray-Ban' } },
                    { name: { contains: 'MON5340' } },
                    { reference: { contains: 'Ray-Ban' } },
                    { reference: { contains: 'MON5340' } }
                ]
            }
        });

        console.log(`Found ${products.length} products.`);
        products.forEach(p => {
            console.log(`[${p.id}] Name: "${p.name}", Ref: "${p.reference}", Stock: ${p.stock}`);
        });

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
findProduct();
