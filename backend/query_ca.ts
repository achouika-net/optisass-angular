import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const caGroup = await prisma.facture.groupBy({
    by: ['type'],
    _sum: { totalTTC: true },
    _count: { _all: true },
  });
  console.log('=== Facture type breakdown ===');
  console.log(JSON.stringify(caGroup, null, 2));

  const allPayments = await prisma.paiement.groupBy({
    by: ['mode'],
    _sum: { montant: true },
    _count: { _all: true },
  });
  console.log('=== Payment modes breakdown ===');
  console.log(JSON.stringify(allPayments, null, 2));

  const lcnPayments = await prisma.paiement.findMany({
    where: {
      OR: [
        { mode: { contains: 'LCN', mode: 'insensitive' } },
        { montant: 1400.2 },
        { montant: 1400.20 },
      ]
    },
    include: { facture: { select: { numero: true, type: true } } }
  });
  console.log('=== LCN or 1400.2 payments ===');
  console.log(JSON.stringify(lcnPayments, null, 2));
}
main().catch(console.error).finally(() => prisma['']());
