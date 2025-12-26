const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Checking database schema for FactureFournisseur ---');
        const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'FactureFournisseur'
      ORDER BY ordinal_position;
    `;
        console.log('Columns in FactureFournisseur table:');
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Error querying schema:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
