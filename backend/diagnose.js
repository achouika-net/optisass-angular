
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env manually to be absolutely sure
const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

console.log('DATABASE_URL from process.env:', process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function main() {
    console.log('--- Diagnosis of Recent Clients (JS) ---');

    try {
        const total = await prisma.client.count();
        console.log('Total clients:', total);

        const inactifCount = await prisma.client.count({ where: { statut: 'INACTIF' } });
        console.log('Total INACTIF clients:', inactifCount);

        const noCentreCount = await prisma.client.count({ where: { centreId: null } });
        console.log('Total clients with NO centreId:', noCentreCount);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const recent = await prisma.client.findMany({
            where: { dateCreation: { gte: today } },
            take: 10,
            select: { id: true, nom: true, statut: true, centreId: true, dateCreation: true }
        });

        console.log('Recent clients:', JSON.stringify(recent, null, 2));
    } catch (err) {
        console.error('Error during database check:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
