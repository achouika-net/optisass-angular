const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Facture'
      ORDER BY column_name;
    `;
        console.log('Columns in Facture table:');
        for (const col of columns) {
            console.log(`- ${col.column_name}: ${col.data_type}`);
        }
    } catch (e) {
        console.error('Error during inspection:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
