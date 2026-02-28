import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
    console.log('--- DB Connection Debug ---');
    console.log('ENV DATABASE_URL:', process.env.DATABASE_URL);

    try {
        const countRaw = await prisma.$queryRaw`SELECT count(*) FROM "Facture"`;
        console.log('Raw count from Facture:', countRaw);

        const countPrisma = await prisma.facture.count();
        console.log('Prisma count from Facture:', countPrisma);

        const dbs = await prisma.$queryRaw`SELECT datname FROM pg_database WHERE datistemplate = false;`;
        console.log('Available databases:', dbs);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
