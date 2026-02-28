import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log('🔍 Checking for duplicate codeClient values...');

        const duplicates = await prisma.$queryRaw`
      SELECT "codeClient", COUNT(*) as count
      FROM "Client"
      WHERE "codeClient" IS NOT NULL AND "codeClient" != ''
      GROUP BY "codeClient"
      HAVING COUNT(*) > 1
    ` as any[];

        if (duplicates.length === 0) {
            console.log('✅ No duplicates found for codeClient.');
        } else {
            console.log('❌ Found duplicates:');
            duplicates.forEach(d => {
                console.log(` - Code: "${d.codeClient}", Count: ${d.count}`);
            });
        }

    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
