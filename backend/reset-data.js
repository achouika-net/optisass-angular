
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env ONLY if DATABASE_URL is not set
if (!process.env.DATABASE_URL && fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

// FORCE "db" host if running in docker
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') && fs.existsSync('/.dockerenv')) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace('localhost', 'db');
}

const prisma = new PrismaClient();

async function main() {
    console.log('--- DB RESET: Clients and Fiches ---');
    console.log('WARNING: This will delete ALL client, fiche, and related financial data!');

    try {
        // Order of deletion to respect FK constraints

        console.log('1. Deleting dependent financial records...');
        await prisma.paiement.deleteMany({});
        await prisma.operationCaisse.deleteMany({});
        await prisma.mouvementStock.deleteMany({});
        await prisma.commission.deleteMany({});
        await prisma.pointsHistory.deleteMany({});
        await prisma.rewardRedemption.deleteMany({});

        console.log('2. Deleting factures...');
        await prisma.facture.deleteMany({});

        console.log('3. Deleting fiches...');
        // Note: Fiche has onDelete: Cascade in prisma for Client, 
        // but explicit delete ensures we don't rely only on DB trigger if any.
        await prisma.fiche.deleteMany({});

        console.log('4. Deleting clients...');
        const clientDelete = await prisma.client.deleteMany({});

        console.log(`✅ Reset complete! Deleted ${clientDelete.count} clients and all associated records.`);

    } catch (err) {
        console.error('Error during database reset:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
