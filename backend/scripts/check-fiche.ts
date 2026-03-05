import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    const targetFicheId = '3071b0e6-5aed-45a1-b10b-54c2901c7708';

    console.log(`🔍 Checking for Fiche ID: ${targetFicheId}`);

    const fiche = await prisma.fiche.findUnique({
        where: { id: targetFicheId }
    });

    if (fiche) {
        console.log('✅ Found Fiche:', {
            id: fiche.id,
            numero: fiche.numero,
            clientId: fiche.clientId
        });
    } else {
        console.log('❌ Fiche NOT FOUND in database.');

        // Check partial matches or total count
        const totalFiches = await prisma.fiche.count();
        console.log(`Total Fiches in DB: ${totalFiches}`);

        // Search for this ID in fichesToCreate logic context? 
        // No, let's just see if there are ANY fiches with this numero if we can find it
    }

    await prisma.$disconnect();
}

main();
