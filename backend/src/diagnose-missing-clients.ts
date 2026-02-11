
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
    console.log('--- Diagnosis of Recent Clients ---');

    // Get total client count
    const total = await prisma.client.count();
    console.log('Total clients:', total);

    // Get clients created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recentlyCreated = await prisma.client.findMany({
        where: {
            dateCreation: {
                gte: today
            }
        },
        orderBy: {
            dateCreation: 'desc'
        },
        take: 20
    });

    console.log(`Found ${recentlyCreated.length} clients created today (showing last 20):`);
    recentlyCreated.forEach(c => {
        console.log(`- ID: ${c.id}, Nom: ${c.nom}, Statut: ${c.statut}, CentreId: ${c.centreId}, Date: ${c.dateCreation}`);
    });

    // Check count of INACTIF clients
    const inactifCount = await prisma.client.count({ where: { statut: 'INACTIF' } });
    console.log('Total INACTIF clients:', inactifCount);

    const actifCount = await prisma.client.count({ where: { statut: 'ACTIF' } });
    console.log('Total ACTIF clients:', actifCount);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
