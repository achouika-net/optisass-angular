import { PrismaClient } from '@prisma/client';
require('dotenv').config();

const prisma = new PrismaClient({ log: ['query'] });

async function main() {
    console.log('Checking Facture model fields...');
    // We can't easily inspect types at runtime, but we can try a simple findFirst
    try {
        const facture = await prisma.facture.findFirst();
        console.log('Facture sample:', facture);

        console.log('Testing executeRaw...');
        await prisma.$executeRaw`SELECT 1`;
        console.log('executeRaw success!');  // Try update on a single record if exists
        if (facture) {
            console.log('Attempting update of one record...');
            await prisma.facture.update({
                where: { id: facture.id },
                data: { ficheId: null }
            });
            console.log('Update success!');
        } else {
            console.log('No factures found to test.');
        }

    } catch (e) {
        console.error('Error during check:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
