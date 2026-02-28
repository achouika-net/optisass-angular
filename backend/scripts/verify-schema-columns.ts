import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log('🔍 Verifying restored columns...');

        const clientsWithCode = await prisma.client.count({
            where: { codeClient: { not: null } }
        });
        const clientsWithGroup = await prisma.client.count({
            where: { groupeId: { not: null } }
        });

        // Use raw query for FactureFournisseur as some fields might not be in the generated client yet due to EPERM
        const ffCounts = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(quantite) as with_quantite,
        COUNT("referenceInterne") as with_ref
      FROM "FactureFournisseur"
    ` as any[];

        console.log('✅ Client counts:');
        console.log(` - codeClient: ${clientsWithCode}`);
        console.log(` - groupeId: ${clientsWithGroup}`);

        console.log('✅ FactureFournisseur counts:');
        console.log(` - Total: ${ffCounts[0].total}`);
        console.log(` - quantite: ${ffCounts[0].with_quantite}`);
        console.log(` - referenceInterne: ${ffCounts[0].with_ref}`);

    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
