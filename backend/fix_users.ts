import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUsers() {
    const ops = await prisma.operationCaisse.findMany({
        where: {
            utilisateur: {
                contains: '-' // Quick way to find UUIDs
            }
        }
    });

    let updatedCount = 0;

    for (const op of ops) {
        // Basic check if it's a UUID
        if (op.utilisateur && op.utilisateur.length === 36 && op.utilisateur.split('-').length === 5) {
            const user = await prisma.user.findUnique({
                where: { id: op.utilisateur }
            });
            if (user) {
                const name = `${user.prenom} ${user.nom}`.trim();
                await prisma.operationCaisse.update({
                    where: { id: op.id },
                    data: { utilisateur: name }
                });
                updatedCount++;
                console.log(`Updated op ${op.id} with user ${name}`);
            }
        }
    }

    console.log(`Finished. Updated ${updatedCount} operations.`);
}

fixUsers().finally(() => prisma.$disconnect());
