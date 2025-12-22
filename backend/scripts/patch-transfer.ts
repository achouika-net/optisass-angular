
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const rabatId = '83b6f0a2-7615-49ae-a5ad-06274585daba';

    // Find products in transit that are missing targetCentreId
    const products = await prisma.product.findMany({
        where: {
            statut: { in: ['RESERVE', 'EN_TRANSIT'] }
        }
    });

    for (const p of products) {
        const sd = p.specificData as any;
        if (sd?.pendingTransfer && !sd.pendingTransfer.targetCentreId) {
            console.log(`Patching product ${p.codeInterne} (${p.designation})...`);
            sd.pendingTransfer.targetCentreId = rabatId; // Defaulting to Rabat for this manual fix

            await prisma.product.update({
                where: { id: p.id },
                data: { specificData: sd }
            });
        }
    }
    console.log('Patch complete.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
