const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clientId = 'dffac540-6938-43de-b8bc-fbc25a4c2fb1';

    console.log('=== RECALCUL DES POINTS FIDELIO POUR CHOUKRA ===\n');

    // Configuration
    const config = await prisma.loyaltyConfig.findFirst();
    const pointsPerDH = 0.1;
    const folderBonus = 30;

    console.log(`Configuration: ${pointsPerDH} pts/DH, ${folderBonus} pts/dossier\n`);

    // Données du client selon la capture d'écran:
    // - 1 fiche médicale (monture)
    // - Chiffre d'affaire: 1775 MAD
    // - Paiements: 1775 MAD

    const nbFiches = 1;
    const montantAchats = 1775; // MAD

    // Calcul
    const pointsDossier = nbFiches * folderBonus;
    const pointsAchats = Math.floor(montantAchats * pointsPerDH);
    const totalPoints = pointsDossier + pointsAchats;

    console.log('=== CALCUL ===');
    console.log(`Dossier médical: ${nbFiches} × ${folderBonus} = ${pointsDossier} pts`);
    console.log(`Achats: ${montantAchats} MAD × ${pointsPerDH} = ${pointsAchats} pts`);
    console.log(`TOTAL: ${totalPoints} pts\n`);

    // Supprimer l'ancien historique
    await prisma.pointsHistory.deleteMany({ where: { clientId } });
    console.log('✓ Ancien historique supprimé\n');

    // Créer le nouvel historique
    const now = new Date();

    // Entrée pour le dossier médical
    await prisma.pointsHistory.create({
        data: {
            clientId,
            points: pointsDossier,
            type: 'FOLDER_CREATION',
            date: now,
            description: `Création dossier médical (monture)`
        }
    });
    console.log(`✓ ${pointsDossier} pts ajoutés pour le dossier médical`);

    // Entrée pour les achats
    await prisma.pointsHistory.create({
        data: {
            clientId,
            points: pointsAchats,
            type: 'EARN',
            date: now,
            description: `Achats (${montantAchats} MAD)`
        }
    });
    console.log(`✓ ${pointsAchats} pts ajoutés pour les achats`);

    // Mettre à jour le solde
    await prisma.client.update({
        where: { id: clientId },
        data: { pointsFidelite: totalPoints }
    });

    console.log(`\n=== RÉSULTAT ===`);
    console.log(`Ancien solde: 50 pts`);
    console.log(`Nouveau solde: ${totalPoints} pts`);
    console.log(`Correction: ${totalPoints > 50 ? '+' : ''}${totalPoints - 50} pts`);
    console.log(`\n✅ Points corrigés avec succès !`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
