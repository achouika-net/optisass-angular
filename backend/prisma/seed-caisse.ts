import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding Caisse...');

    // Find the first centre (usually Centre OptiSass Paris from main seed)
    const centre = await prisma.centre.findFirst();

    if (!centre) {
        console.error('❌ No centre found. Please run the main seed first.');
        process.exit(1);
    }

    console.log(`Found centre: ${centre.nom}`);

    // Check if Caisse exists
    const existingCaisse = await prisma.caisse.findFirst({
        where: {
            nom: 'Caisse Principale',
            centreId: centre.id
        }
    });

    if (existingCaisse) {
        console.log('✅ Caisse already exists.');
        return;
    }

    // Create Caisse Principale
    const caisse = await prisma.caisse.create({
        data: {
            nom: 'Caisse Principale',
            description: 'Caisse principale du magasin',
            statut: 'active', // Using lowercase as per common Prisma enum convention or string if enum
            centreId: centre.id
        }
    });

    console.log(`✅ Caisse created: ${caisse.nom}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
