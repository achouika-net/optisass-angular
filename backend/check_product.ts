
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const productId = '64d5e7ed-1369-43ca-800f-080a911e83f0';
    const product = await prisma.product.findUnique({
        where: { id: productId },
    });

    if (!product) {
        console.log('Product not found');
        return;
    }

    console.log('Product found:', product.id);
    console.log('SpecificData:', JSON.stringify(product.specificData, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
