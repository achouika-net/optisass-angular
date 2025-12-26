const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Checking FactureFournisseur model structure ---');
        const first = await prisma.factureFournisseur.findFirst();
        console.log('Successfully queried FactureFournisseur. Result keys:', Object.keys(first || {}));

        console.log('--- Attempting findMany with filters ---');
        const result = await prisma.factureFournisseur.findMany({
            orderBy: { dateEmission: 'desc' },
            take: 1
        });
        console.log('findMany successful. Count:', result.length);
    } catch (e) {
        console.error('Error during diagnostic:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
