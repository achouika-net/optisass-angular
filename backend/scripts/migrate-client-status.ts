import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateClientStatus() {
    console.log('🔄 Starting client status migration...');

    // Find all clients with fiches but status is INACTIF
    const clients = await prisma.client.findMany({
        where: {
            statut: 'INACTIF',
        },
        include: {
            fiches: true,
        },
    });

    console.log(`📊 Found ${clients.length} INACTIF clients`);

    let updated = 0;

    for (const client of clients) {
        if (client.fiches.length > 0) {
            await prisma.client.update({
                where: { id: client.id },
                data: { statut: 'ACTIF' },
            });
            console.log(`✅ Updated client ${client.id} (${client.nom || 'N/A'}) to ACTIF (${client.fiches.length} fiches)`);
            updated++;
        }
    }

    console.log(`\n✨ Migration complete: ${updated} clients updated to ACTIF`);
    console.log(`📋 ${clients.length - updated} clients remain INACTIF (no fiches)`);
}

updateClientStatus()
    .catch((e) => {
        console.error('❌ Error during migration:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
