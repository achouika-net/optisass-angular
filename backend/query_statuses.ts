import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const invoiceStatuses = await prisma.factureFournisseur.groupBy({
    by: ['statut'],
    _count: true
  });
  console.log('FactureFournisseur Statuses:', JSON.stringify(invoiceStatuses, null, 2));

  const blStatuses = await prisma.bonLivraison.groupBy({
    by: ['statut'],
    _count: true
  });
  console.log('BonLivraison Statuses:', JSON.stringify(blStatuses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
