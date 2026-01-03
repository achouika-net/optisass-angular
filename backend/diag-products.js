
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Testing Product Query ---');
        const products = await prisma.product.findMany({
            take: 5,
            include: {
                entrepot: {
                    include: {
                        centre: true
                    }
                }
            }
        });
        console.log(`Successfully fetched ${products.length} products.`);
        if (products.length > 0) {
            console.log('Sample product:', JSON.stringify(products[0], null, 2));
        }
    } catch (error) {
        console.error('ERROR during product query:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
