const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const products = await prisma.product.findMany({
        where: { designation: { contains: "VOGUE" } },
        take: 10
    });
    console.log('VOGUE products found:', products.length);
    products.forEach(p => console.log(`- ${p.designation} | id: ${p.id} | PurchasePrice: ${p.prixAchatHT}`));
    process.exit(0);
}
main();
