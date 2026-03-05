import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Audit ---');

    // 1. Count by Type
    const counts = await prisma.facture.groupBy({
        by: ['type'],
        _count: { _all: true },
        // _sum: { totalTTC: true } // Some environments might not support it directly in table
    });
    console.log('Counts by Type:');
    console.table(counts);

    // 1b. Sum totalTTC
    const totalSum = await prisma.facture.aggregate({
        _sum: { totalTTC: true }
    });
    console.log('Global totalTTC:', totalSum._sum.totalTTC);

    // 2. Search for Duplicate Numbers
    // Note: PostgreSQL specific if using Prisma queryRaw
    const duplicates = await prisma.$queryRaw`
    SELECT numero, COUNT(*) as count, SUM("totalTTC") as total_sum
    FROM "Facture"
    GROUP BY numero
    HAVING COUNT(*) > 1
    LIMIT 20
  `;
    console.log('\nPotential Duplicate Numbers (sample):');
    console.table(duplicates);

    // 3. Check for records with different prefixes but same number
    const prefixCheck = await prisma.$queryRaw`
    SELECT 
      regexp_replace(numero, '^(Fact-|BC-|FAC-)', '') as simple_num,
      COUNT(*) as count,
      ARRAY_AGG(numero) as versions
    FROM "Facture"
    GROUP BY 1
    HAVING COUNT(*) > 1
    LIMIT 20
  `;
    console.log('\nRecords with same number but different prefixes:');
    console.table(prefixCheck);

    // 4. Sample check of a few latest factures
    const sampleFactures = await prisma.facture.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            numero: true,
            type: true,
            totalTTC: true,
            createdAt: true,
            updatedAt: true
        }
    });
    console.log('\nLatest 5 Factures:');
    console.table(sampleFactures);

    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
