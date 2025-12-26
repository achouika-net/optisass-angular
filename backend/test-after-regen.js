const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Testing FactureFournisseur after regeneration ---');
        const result = await prisma.factureFournisseur.findMany({
            take: 1,
            orderBy: { dateEmission: 'desc' }
        });
        console.log('✅ SUCCESS! Query worked. Found:', result.length, 'records');
        if (result.length > 0) {
            console.log('Sample record keys:', Object.keys(result[0]));
        }
    } catch (e) {
        console.error('❌ FAILED:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
