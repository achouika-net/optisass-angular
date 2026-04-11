import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- REPERCUSSION DES DATES POUR LES AJUSTEMENTS ---');

  const adjustments = await prisma.paiement.findMany({
    where: { notes: 'Ajustement auto - Correction surplus import historique' },
    include: {
      facture: {
        include: { paiements: true }
      }
    }
  });

  console.log(`Found ${adjustments.length} adjustments to fix.`);

  let updatedCount = 0;

  for (const adj of adjustments) {
    // Find all other payments for this facture
    const otherPayments = adj.facture.paiements.filter(p => p.id !== adj.id);
    
    let targetDate = adj.facture.dateEmission;
    
    if (otherPayments.length > 0) {
      // Find the latest date among other payments
      targetDate = otherPayments.reduce((latest, current) => {
        return current.date > latest ? current.date : latest;
      }, otherPayments[0].date);
    }

    await prisma.paiement.update({
      where: { id: adj.id },
      data: { date: targetDate }
    });
    updatedCount++;
  }

  console.log(`Successfully moved ${updatedCount} adjustments to their historical dates.`);

  await prisma.$disconnect();
}

main().catch(console.error);
