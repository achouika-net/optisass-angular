const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    console.log('🚀 Starting Fidelio Points Recalculation (JS Version)...');

    // 1. Get Loyalty Config
    let config = await prisma.loyaltyConfig.findFirst();
    if (!config) {
        console.log('⚙️ No config found. Creating default...');
        config = await prisma.loyaltyConfig.create({
            data: {
                pointsPerDH: 0.1,
                referrerBonus: 50,
                refereeBonus: 20,
                folderCreationBonus: 30,
                rewardThreshold: 500,
                pointsToMADRatio: 0.1,
            },
        });
    }

    const pointsPerDH = config.pointsPerDH || 0.1;
    const folderBonus = config.folderCreationBonus || 30;

    console.log(`📊 Config: ${pointsPerDH} pts/DH, ${folderBonus} pts per folder.`);

    // 2. Award points for Factures
    const factures = await prisma.facture.findMany({
        where: {
            type: 'FACTURE',
            statut: { in: ['VALIDE', 'PAYEE', 'PARTIEL'] },
        }
    });

    console.log(`📄 Found ${factures.length} valid factures.`);
    let factureCount = 0;
    let totalFacturePoints = 0;

    for (const f of factures) {
        const existing = await prisma.pointsHistory.findFirst({
            where: { factureId: f.id, type: 'EARN' }
        });

        if (existing) continue;

        const points = Math.floor(f.totalTTC * pointsPerDH);
        if (points <= 0) continue;

        await prisma.$transaction([
            prisma.client.update({
                where: { id: f.clientId },
                data: { pointsFidelite: { increment: points } },
            }),
            prisma.pointsHistory.create({
                data: {
                    clientId: f.clientId,
                    factureId: f.id,
                    points: points,
                    type: 'EARN',
                    description: `Achat facture ${f.numero} (Régularisation)`,
                    date: f.dateEmission,
                },
            }),
        ]);
        factureCount++;
        totalFacturePoints += points;
        if (factureCount % 100 === 0) console.log(`... processed ${factureCount} factures`);
    }

    console.log(`✅ Awarded ${totalFacturePoints} points for ${factureCount} factures.`);

    // 3. Award points for Folder Creation (Fiches)
    const fiches = await prisma.fiche.findMany();

    console.log(`📁 Found ${fiches.length} medical folders.`);
    let folderCount = 0;
    let totalFolderPoints = 0;

    for (const fiche of fiches) {
        const existing = await prisma.pointsHistory.findFirst({
            where: {
                clientId: fiche.clientId,
                type: 'FOLDER_CREATION',
                description: { contains: fiche.id }
            }
        });

        if (existing) continue;

        await prisma.$transaction([
            prisma.client.update({
                where: { id: fiche.clientId },
                data: { pointsFidelite: { increment: folderBonus } },
            }),
            prisma.pointsHistory.create({
                data: {
                    clientId: fiche.clientId,
                    points: folderBonus,
                    type: 'FOLDER_CREATION',
                    description: `Création dossier médical fiche ${fiche.id} (Régularisation)`,
                    date: fiche.createdAt,
                },
            }),
        ]);
        folderCount++;
        totalFolderPoints += folderBonus;
        if (folderCount % 100 === 0) console.log(`... processed ${folderCount} folders`);
    }

    console.log(`✅ Awarded ${totalFolderPoints} points for ${folderCount} folders.`);
    console.log('🏁 Recalculation complete.');
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
