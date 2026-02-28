const { PrismaClient } = require('@prisma/client');

async function listDbs() {
    // Connect to whatever default DB Prisma reaches 
    const prisma = new PrismaClient();

    try {
        const res = await prisma.$queryRawUnsafe(`
            SELECT d.datname as "Name",
            pg_size_pretty(pg_database_size(d.datname)) as "Size"
            FROM pg_catalog.pg_database d
            ORDER BY pg_database_size(d.datname) DESC;
        `);

        console.log('--- ALL POSTGRESQL DATABASES BY SIZE ---');
        res.forEach(row => {
            console.log(`${row.Name.padEnd(20)} | ${row.Size}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

listDbs();
