const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const paymentId = 'e356cabc-4d5a-4f28-b983-e10aecb12a76';
    const paiement = await prisma.paiement.findUnique({
        where: { id: paymentId },
        include: { facture: true }
    });
    
    console.log('Facture targetCentreId:', paiement.facture.centreId);
    
    let targetCentreId = paiement.facture?.centreId;
    if (!targetCentreId && paiement.facture?.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: paiement.facture.clientId },
        select: { centreId: true }
      });
      targetCentreId = client?.centreId;
    }
    console.log('Resolved targetCentreId:', targetCentreId);

    const caisseType = 'PRINCIPALE';
    
    const openSessions = await prisma.journeeCaisse.findMany({
      where: {
        centreId: targetCentreId,
        statut: 'OUVERTE',
        caisse: {
          OR: [{ type: caisseType }, { type: 'MIXTE' }],
        },
      },
      include: { caisse: true },
    });
    
    console.log('Found open sessions:', openSessions.map(os => `${os.id} (${os.caisse.type})`));
    
    const openJournee = openSessions.find((j) => j.caisse.type === 'MIXTE') || openSessions[0];
    
    console.log('Selected open session:', openJournee ? openJournee.id : 'NONE');
}

main().finally(() => prisma.$disconnect());
