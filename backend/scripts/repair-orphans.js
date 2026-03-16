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
    if (!openJournee) return console.log('No open journee for', targetCentreId);

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
          utilisateur: 'Système (Auto-Repair)',
          userId: null,
          journeeCaisseId: openJournee.id,
          factureId: facture.id,
        },
    });
    console.log('Linked payment to new Operation', operation.id);
    
    await tx.paiement.update({
        where: { id: paiement.id },
        data: { operationCaisseId: operation.id },
    });
    
    await tx.journeeCaisse.update({
      where: { id: openJournee.id },
      data: {
        totalComptable: { increment: paiement.montant },
        totalVentesEspeces: (paiement.mode === 'ESPECES' || paiement.mode === 'ESPECE') ? { increment: paiement.montant } : undefined,
        totalVentesCarte: (paiement.mode === 'CARTE') ? { increment: paiement.montant } : undefined,
        totalVentesCheque: (paiement.mode === 'CHEQUE' || paiement.mode === 'CHÈQUE') ? { increment: paiement.montant } : undefined,
      },
    });
}

async function main() {
    console.log('--- Repairing Orphaned Payments ---');
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000); // last 2 hours

    const orphans = await prisma.paiement.findMany({
        where: { createdAt: { gte: oneHourAgo }, operationCaisseId: null },
        include: { facture: true }
    });
    
    console.log(`Found ${orphans.length} orphaned payments to repair.`);
    
    for (const p of orphans) {
        console.log(`Repairing payment ${p.id}...`);
        try {
            await prisma.$transaction(async (tx) => {
                await handleCaisseIntegration(tx, p, p.facture, null);
            });
        } catch(e) { console.error('Error repairing', p.id, e); }
    }
    console.log('Done.');
}
main().finally(() => prisma.$disconnect());
