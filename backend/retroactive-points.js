const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('🔄 Démarrage du recalcul des points...');
    // 1. Get Loyalty Config
    const config = await prisma.loyaltyConfig.findFirst();
    if (!config) {
        console.error('❌ Configuration de loyauté introuvable.');
        return;
    }
    const ratio = config.pointsPerDH || 0.1;
    console.log(`⚙ Ratio configuré: ${ratio} points / MAD`);

    // 2. Find eligible factures (PAYEE, PARTIEL, ou VALIDE)
    const factures = await prisma.facture.findMany({
        where: {
            statut: { in: ['VALIDE', 'PARTIEL', 'PAYEE', 'VALIDEE', 'BON_DE_COMMANDE'] },
            type: { in: ['FACTURE', 'BON_COMM', 'BON_COMMANDE'] }
        }
    });

    // 3. Find if they already have EARN points
    const facturesWithEarnPoints = await prisma.pointsHistory.findMany({
        where: {
            type: 'EARN',
            factureId: { in: factures.map(f => f.id) }
        }
    });

    const idsWithPoints = new Set(facturesWithEarnPoints.map(p => p.factureId));

    const missingFactures = factures.filter(f =>
        !idsWithPoints.has(f.id) && f.totalTTC > 0
    );

    console.log(`🔍 Trouvé ${missingFactures.length} factures valides sans points attribués.`);

    // 4. Award points
    let ptsUpdated = 0;
    let clientsUpdated = new Set();

    for (const facture of missingFactures) {
        const pointsToAward = Math.floor(facture.totalTTC * ratio);
        if (pointsToAward <= 0) continue;

        try {
            await prisma.$transaction([
                prisma.client.update({
                    where: { id: facture.clientId },
                    data: { pointsFidelite: { increment: pointsToAward } }
                }),
                prisma.pointsHistory.create({
                    data: {
                        clientId: facture.clientId,
                        factureId: facture.id,
                        points: pointsToAward,
                        type: 'EARN',
                        description: `Achat facture/BC ${facture.numero} (Récupération)`
                    }
                })
            ]);
            ptsUpdated += pointsToAward;
            clientsUpdated.add(facture.clientId);
            console.log(`✅ Attribué ${pointsToAward} pts au client ${facture.clientId} pour le document ${facture.numero}`);
        } catch (e) {
            console.error(`❌ Erreur pour la facture ${facture.numero}:`, e.message);
        }
    }

    console.log('--- RÉSUMÉ ---');
    console.log(`Total factures traitées: ${missingFactures.length}`);
    console.log(`Total points distribués: ${ptsUpdated}`);
    console.log(`Total clients mis à jour: ${clientsUpdated.size}`);
}

run().finally(() => prisma.$disconnect());
