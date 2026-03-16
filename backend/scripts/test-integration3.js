const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function handleCaisseIntegration(tx, paiement, facture, userId) {
    let targetCentreId = facture?.centreId;
    if (!targetCentreId && facture?.clientId) {
      const client = await tx.client.findUnique({
        where: { id: facture.clientId },
        select: { centreId: true }
      });
      targetCentreId = client?.centreId;
    }

    const caisseType = 'PRINCIPALE';
    const openSessions = await tx.journeeCaisse.findMany({
      where: {
        centreId: targetCentreId,
        statut: 'OUVERTE',
        caisse: { OR: [{ type: caisseType }, { type: 'MIXTE' }] },
      },
      include: { caisse: true },
    });
    
    const openJournee = openSessions.find((j) => j.caisse.type === 'MIXTE') || openSessions[0];
    if (!openJournee) return console.log('No open journee');

    const absMontant = Math.abs(paiement.montant);
    const isRefund = paiement.montant < 0;

    const operation = await tx.operationCaisse.create({
        data: {
          type: isRefund ? 'DECAISSEMENT' : 'ENCAISSEMENT',
          typeOperation: 'COMPTABLE',
          montant: absMontant,
          moyenPaiement: paiement.mode,
          reference: paiement.reference || `FAC ${facture.numero}`,
          motif: `Paiement: FAC ${facture.numero}`,
          utilisateur: 'Système',
          userId: null,
          journeeCaisseId: openJournee.id,
          factureId: facture.id,
        },
    });
    console.log('Created operation!', operation.id);
    
    await tx.paiement.update({
        where: { id: paiement.id },
        data: { operationCaisseId: operation.id },
    });
    
    await tx.journeeCaisse.update({
      where: { id: openJournee.id },
      data: {
        totalComptable: { increment: paiement.montant },
        totalVentesEspeces:
          (paiement.mode === 'ESPECES' || paiement.mode === 'ESPECE')
            ? { increment: paiement.montant }
            : undefined,
      },
    });
    console.log('Success inside tx!');
}

async function main() {
    const paymentId = '8459ffde-6654-41a8-bece-541c75e089b0';
    const paiement = await prisma.paiement.findUnique({
        where: { id: paymentId },
        include: { facture: true }
    });

    try {
        await prisma.$transaction(async (tx) => {
            await handleCaisseIntegration(tx, paiement, paiement.facture, null);
        });
    } catch (e) {
        console.error('FAILED IN TX!', e);
    }
}

main().finally(() => prisma.$disconnect());
