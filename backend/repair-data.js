
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env
if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const prisma = new PrismaClient();

async function main() {
    console.log('--- REPAIR SCRIPT: Restoration of Imported Data ---');

    try {
        // 1. Find the default center (just take the first one if none specified, or look for one)
        const centers = await prisma.centre.findMany();
        if (centers.length === 0) {
            console.error('No centers found in database. Cannot assign centreId.');
            return;
        }
        const defaultCentreId = centers[0].id;
        console.log(`Default centre selected for repair: ${centers[0].nom} (${defaultCentreId})`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 2. Fix Clients
        const clientResults = await prisma.client.updateMany({
            where: {
                dateCreation: { gte: today },
                OR: [
                    { statut: 'INACTIF' },
                    { centreId: null }
                ]
            },
            data: {
                statut: 'ACTIF',
                centreId: defaultCentreId
            }
        });
        console.log(`Updated ${clientResults.count} clients to ACTIF and assigned centreId.`);

        // 3. Fix Fiches
        const ficheResults = await prisma.fiche.updateMany({
            where: {
                dateCreation: { gte: today },
                centreId: null
            },
            data: {
                centreId: defaultCentreId
            }
        });
        console.log(`Updated ${ficheResults.count} fiches with missing centreId.`);

        console.log('✅ Repair completed successfully.');
    } catch (err) {
        console.error('Error during repair:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
