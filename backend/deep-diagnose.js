
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
    console.log('--- FINAL VERIFICATION: Empty Tables ---');

    try {
        const totalClients = await prisma.client.count();
        const totalFiches = await prisma.fiche.count();
        const totalFactures = await prisma.facture.count();
        const totalPaiements = await prisma.paiement.count();

        console.log(`Summary Counts:`);
        console.log(` - Clients: ${totalClients}`);
        console.log(` - Fiches: ${totalFiches}`);
        console.log(` - Factures: ${totalFactures}`);
        console.log(` - Paiements: ${totalPaiements}`);

        if (totalClients === 0 && totalFiches === 0) {
            console.log('✅ Success: Tables are empty.');
        } else {
            console.log('❌ Failure: Tables still contain records.');
        }

    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
