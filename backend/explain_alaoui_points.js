const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clientId = '680711ed-5783-448d-8697-de34872bf779';
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: {
            factures: true,
            pointsHistory: { orderBy: { date: 'asc' } },
            fiches: true
        }
    });

    console.log('--- EXPLICATION POINTS FIDELIO: ' + client.nom + ' ---');
    console.log('Total Actuel:', client.pointsFidelite);

    console.log('\n--- Détail de l\'historique ---');
    client.pointsHistory.forEach(h => {
        console.log(`- [${h.date.toISOString()}] ${h.points} pts | Type: ${h.type} | Description: ${h.description}`);
    });

    console.log('\n--- Factures ---');
    client.factures.forEach(f => {
        console.log(`- Facture ${f.numero}: ${f.totalTTC} MAD | Status: ${f.status}`);
    });

    console.log('\n--- Fiches Médicales ---');
    console.log(`Nombre total: ${client.fiches.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
