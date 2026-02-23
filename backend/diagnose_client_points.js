const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const client = await prisma.client.findFirst({
        where: {
            nom: { contains: 'FETH', mode: 'insensitive' },
            prenom: { contains: 'Khadija', mode: 'insensitive' }
        },
        include: {
            factures: {
                include: {
                    paiements: true,
                    pointsHistory: true
                }
            },
            pointsHistory: true
        }
    });

    if (!client) {
        console.log("Client not found.");
        return;
    }

    console.log(`Client found: ${client.nom} ${client.prenom} (Points: ${client.pointsFidelite})`);

    for (const f of client.factures) {
        const totalPaye = f.paiements.reduce((sum, p) => sum + p.montant, 0);
        console.log(`- Facture ${f.numero} | Type: ${f.type} | Statut: ${f.statut} | Total TTC: ${f.totalTTC} | Total Paye: ${totalPaye} | Paiements: ${f.paiements.length} | Points EARN: ${f.pointsHistory ? f.pointsHistory.filter(p => p.type === 'EARN').length : 0}`);
    }
}

run().finally(() => prisma.$disconnect());
