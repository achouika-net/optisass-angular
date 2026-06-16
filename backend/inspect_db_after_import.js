const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fichesCount = await prisma.fiche.count();
  const fichesGrouped = await prisma.fiche.groupBy({
    by: ['type', 'statut'],
    _count: true
  });
  console.log('Total Fiches:', fichesCount);
  console.log('Fiches grouped:', JSON.stringify(fichesGrouped, null, 2));

  const facturesCount = await prisma.facture.count();
  const facturesGrouped = await prisma.facture.groupBy({
    by: ['type', 'statut'],
    _count: true,
    _sum: { totalTTC: true, resteAPayer: true }
  });
  console.log('Total Factures:', facturesCount);
  console.log('Factures grouped:', JSON.stringify(facturesGrouped, null, 2));

  const paymentsCount = await prisma.paiement.count();
  const paymentsSum = await prisma.paiement.aggregate({
    _sum: { montant: true }
  });
  console.log('Total Payments:', paymentsCount);
  console.log('Payments sum:', paymentsSum._sum.montant);
}

main().catch(console.error).finally(() => prisma.$disconnect());
