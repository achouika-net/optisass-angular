const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clientId = 'dffac540-6938-43de-b8bc-fbc25a4c2fb1';

    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
            id: true,
            nom: true,
            raisonSociale: true,
            pointsFidelite: true
        }
    });

    console.log('=== CLIENT ===');
    console.log(`Nom: ${client.nom || client.raisonSociale}`);
    console.log(`Points actuels dans la DB: ${client.pointsFidelite}`);

    console.log('\n=== HISTORIQUE DES POINTS ===');
    const history = await prisma.pointsHistory.findMany({
        where: { clientId },
        orderBy: { date: 'asc' }
    });

    if (history.length === 0) {
        console.log('Aucun historique trouvé');
    } else {
        let cumul = 0;
        history.forEach((h, i) => {
            cumul += h.points;
            console.log(`${i + 1}. [${h.date.toISOString().split('T')[0]}] ${h.type} | ${h.points > 0 ? '+' : ''}${h.points} pts | Total: ${cumul} pts`);
            console.log(`   Description: ${h.description}`);
        });
        console.log(`\nTotal calculé: ${cumul} pts`);
    }

    console.log('\n=== FACTURES ===');
    const factures = await prisma.facture.findMany({
        where: { clientId, type: { in: ['FAC', 'AVOIR'] } },
        orderBy: { createdAt: 'asc' }
    });

    console.log(`Nombre de factures: ${factures.length}`);
    factures.forEach(f => {
        console.log(`- ${f.numero} | ${f.totalTTC} MAD | Type: ${f.type} | Status: ${f.status}`);
    });

    console.log('\n=== FICHES MÉDICALES ===');
    const fiches = await prisma.fiche.findMany({
        where: { clientId }
    });
    console.log(`Nombre de fiches: ${fiches.length}`);

    console.log('\n=== CONFIGURATION FIDELIO ===');
    const config = await prisma.loyaltyConfig.findFirst();
    console.log(`Points par DH: ${config.pointsPerDH}`);
    console.log(`Bonus parrain: ${config.referrerBonus}`);
    console.log(`Bonus filleul: ${config.refereeBonus}`);
    console.log(`Bonus dossier médical: ${config.folderCreationBonus || 'N/A'}`);

    console.log('\n=== ANALYSE ===');
    console.log(`Points attendus selon l'historique: ${cumul}`);
    console.log(`Points réels dans la DB: ${client.pointsFidelite}`);
    console.log(`Différence: ${client.pointsFidelite - cumul}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
