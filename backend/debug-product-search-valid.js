
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function findProduct() {
    try {
        console.log('Exhaustive Search for MON5340...');
        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { designation: { contains: 'MON5340' } },
                    { codeInterne: { contains: 'MON5340' } },
                    { codeBarres: { contains: 'MON5340' } },
                    { modele: { contains: 'MON5340' } },
                    { marque: { contains: 'Ray-Ban' } } // Still check Ray-Ban to see if it's there but named differently
                ]
            }
        });

        console.log(`Found ${products.length} products.`);
        products.forEach(p => {
            console.log(`[${p.id}] Code: ${p.codeInterne} | Marque: ${p.marque} | Modele: ${p.modele} | Desig: ${p.designation}`);
        });

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
findProduct();
