const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const paymentId = 'e356cabc-4d5a-4f28-b983-e10aecb12a76';
    const paiement = await prisma.paiement.findUnique({
        where: { id: paymentId },
        include: { facture: true }
    });
    
    let targetCentreId = paiement.facture?.centreId;
    if (!targetCentreId && paiement.facture?.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: paiement.facture.clientId },
        select: { centreId: true }
      });
      targetCentreId = client?.centreId;
    }

    const caisseType = 'PRINCIPALE';
    const openSessions = await prisma.journeeCaisse.findMany({
      where: {
        centreId: targetCentreId,
        statut: 'OUVERTE',
        caisse: { OR: [{ type: caisseType }, { type: 'MIXTE' }] },
      },
      include: { caisse: true },
    });
    
    const openJournee = openSessions.find((j) => j.caisse.type === 'MIXTE') || openSessions[0];
    if (!openJournee) return console.log('No open journee');

    try {
        const absMontant = Math.abs(paiement.montant);
        const isRefund = paiement.montant < 0;

        console.log('Attempting to create OperationCaisse...');
        const operation = await prisma.operationCaisse.create({
            data: {
              type: isRefund ? 'DECAISSEMENT' : 'ENCAISSEMENT',
              typeOperation: 'COMPTABLE',
              montant: absMontant,
              moyenPaiement: paiement.mode,
              reference: paiement.reference || `FAC ${paiement.facture.numero}`,
              motif: isRefund
                ? 'Régularisation Avoir'
                : `Paiement: FAC ${paiement.facture.numero}`,
              utilisateur: 'Système',
              userId: null,
              journeeCaisseId: openJournee.id,
              factureId: paiement.facture.id,
            },
        });
        console.log('Created operation!', operation.id);
        
        console.log('Attempting to link Paiement...');
        await prisma.paiement.update({
            where: { id: paiement.id },
            data: { operationCaisseId: operation.id },
        });
        
        console.log('Attempting to update JourneeCaisse totals...');
        await prisma.journeeCaisse.update({
          where: { id: openJournee.id },
          data: {
            totalComptable: { increment: paiement.montant },
            totalVentesEspeces:
              (paiement.mode === 'ESPECES' || paiement.mode === 'ESPECE')
                ? { increment: paiement.montant }
                : undefined,
            totalVentesCarte:
              paiement.mode === 'CARTE'
                ? { increment: paiement.montant }
                : undefined,
            totalVentesCheque:
              (paiement.mode === 'CHEQUE' || paiement.mode === 'CHÈQUE')
                ? { increment: paiement.montant }
                : undefined,
          },
        });
        console.log('Success!');
    } catch (e) {
        console.error('FAILED!', e);
    }
}

main().finally(() => prisma.$disconnect());
