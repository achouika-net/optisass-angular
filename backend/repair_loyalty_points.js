const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clientId = '680711ed-5783-448d-8697-de34872bf779';
    const fiches = await prisma.fiche.findMany({ where: { clientId } });
    const config = await prisma.loyaltyConfig.findFirst();
    const bonus = config.folderCreationBonus || 30;

    console.log(`Found ${fiches.length} fiches for Alaoui. Bonus: ${bonus}`);

    for (const fiche of fiches) {
        const existing = await prisma.pointsHistory.findFirst({
            where: { clientId, type: 'FOLDER_CREATION', description: { contains: fiche.id } }
        });

        if (!existing) {
            console.log(`Awarding ${bonus} points for fiche ${fiche.id}...`);
            await prisma.$transaction([
                prisma.client.update({
                    where: { id: clientId },
                    data: { pointsFidelite: { increment: bonus } }
                }),
                prisma.pointsHistory.create({
                    data: {
                        clientId: clientId,
                        points: bonus,
                        type: 'FOLDER_CREATION',
                        description: `Régularisation: Création dossier médical fiche ${fiche.id}`
                    }
                })
            ]);
        } else {
            console.log(`Points already exist for fiche ${fiche.id}.`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
