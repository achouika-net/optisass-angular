const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Moving recent payments to Mixte Caisse ---');
    
    // Find the open Mixte caisse session
    const mixteCaisse = await prisma.caisse.findFirst({ where: { type: 'MIXTE' } });
    if (!mixteCaisse) { console.log('No Mixte caisse found'); return; }
    
    const mixteSession = await prisma.journeeCaisse.findFirst({
        where: { caisseId: mixteCaisse.id, statut: 'OUVERTE' }
    });
    if (!mixteSession) { console.log('No open Mixte session found'); return; }

    console.log(`Open Mixte Session: ${mixteSession.id}`);

    // Get 5 recent payments
    const recentPayments = await prisma.paiement.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${recentPayments.length} recent payments to migrate.`);

    for (const payment of recentPayments) {
        console.log(`Migrating payment ${payment.id} (Mode: ${payment.mode}, Montant: ${payment.montant})...`);
        
        // Find existing operation
        if (payment.operationCaisseId) {
            const oldOp = await prisma.operationCaisse.findUnique({ where: { id: payment.operationCaisseId }});
            if (oldOp) {
                // Update to point to the mixte session
                await prisma.operationCaisse.update({
                    where: { id: oldOp.id },
                    data: { journeeCaisseId: mixteSession.id }
                });
                console.log(`  -> Moved operation ${oldOp.id} to Mixte session.`);
            }
        }
    }
    console.log('Done migrating data. Please check the dashboard now.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
