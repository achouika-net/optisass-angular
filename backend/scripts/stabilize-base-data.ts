import { PrismaClient } from '@prisma/client';
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    console.log('🛠️ Stabilizing Base Configuration...');

    try {
        // 1. Ensure a standard Group exists
        const group = await prisma.groupe.upsert({
            where: { id: 'default-group-id' }, // We use a fixed ID for stability
            update: { nom: 'Groupe Principal' },
            create: {
                id: 'default-group-id',
                nom: 'Groupe Principal',
                description: 'Groupe par défaut'
            }
        });
        console.log('✅ Group stabilized:', group.nom);

        // 2. Ensure a standard Centre exists
        const centre = await prisma.centre.upsert({
            where: { id: 'default-centre-id' }, // Fixed ID
            update: { nom: 'Centre Principal', groupeId: group.id },
            create: {
                id: 'default-centre-id',
                nom: 'Centre Principal',
                adresse: 'Default Address',
                ville: 'Casablanca',
                groupeId: group.id
            }
        });
        console.log('✅ Centre stabilized:', centre.nom);

        // 3. Optional: Link existing orphaned records if any (advanced)

        console.log('\n✨ Base configuration is now STABLE with fixed IDs.');
        console.log('This prevents frontend "stale ID" errors after resets.');
    } catch (error) {
        console.error('❌ Error during stabilization:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
