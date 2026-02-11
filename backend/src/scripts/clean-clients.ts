import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Purging Client table...');
    try {
        const count = await prisma.client.deleteMany({});
        console.log(`✅ Success! Deleted ${count.count} clients.`);
    } catch (error) {
        console.error('❌ Error purging clients:', error);
        process.exit(1);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
