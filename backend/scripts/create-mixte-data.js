const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Creating Dummy Payments for Mixte Caisse ---');
    
    // Find open Mixte session
    const mixteSession = await prisma.journeeCaisse.findFirst({
        where: { caisse: { type: 'MIXTE' }, statut: 'OUVERTE' },
        include: { caisse: true }
    });
    
    if (!mixteSession) { console.log('No open Mixte session found'); return; }

    console.log(`Open Mixte Session: ${mixteSession.id} (Caisse: ${mixteSession.caisse.nom})`);

    // Create 3 operations
    const operationsToCreate = [
        { type: 'ENTREE', montant: 500, moyenPaiement: 'ESPECES', reference: 'DUMMY-1' },
        { type: 'ENTREE', montant: 1500, moyenPaiement: 'CARTE', reference: 'DUMMY-2' },
        { type: 'ENTREE', montant: 200, moyenPaiement: 'ESPECES', reference: 'DUMMY-3' },
    ];

    let newOps = 0;
    let totalEsp = 0;
    let totalCarte = 0;
    let totalComptable = 0;

    for (const op of operationsToCreate) {
        await prisma.operationCaisse.create({
            data: {
                journeeCaisseId: mixteSession.id,
                type: op.type,
                montant: op.montant,
                moyenPaiement: op.moyenPaiement,
                reference: op.reference,
                motif: 'Test Mixed Dashboard',
                utilisateur: 'System'
            }
        });
        
        console.log(`Created operation: ${op.moyenPaiement} - ${op.montant} DH`);
        
        newOps++;
        totalComptable += op.montant;
        if (op.moyenPaiement === 'ESPECES') totalEsp += op.montant;
        if (op.moyenPaiement === 'CARTE') totalCarte += op.montant;
    }

    // Update session totals
    await prisma.journeeCaisse.update({
        where: { id: mixteSession.id },
        data: {
            totalComptable: { increment: totalComptable },
            totalVentesEspeces: { increment: totalEsp },
            totalVentesCarte: { increment: totalCarte }
        }
    });

    console.log(`Successfully generated ${newOps} dummy transactions in the Mixte session.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
