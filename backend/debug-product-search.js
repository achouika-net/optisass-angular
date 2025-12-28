
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function findProduct() {
    try {
        console.log('Searching for products...');
        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { name: { contains: 'Ray-Ban', mode: 'insensitive' } },
                    { name: { contains: 'MON5340', mode: 'insensitive' } },
                    { reference: { contains: 'Ray-Ban', mode: 'insensitive' } },
                    { reference: { contains: 'MON5340', mode: 'insensitive' } }
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
