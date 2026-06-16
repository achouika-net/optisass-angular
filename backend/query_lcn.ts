import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Searching for 1400.2 or LCN in payments ===');
  const payments = await prisma.paiement.findMany({
    where: {
      OR: [
        { montant: { gte: 1400, lte: 1401 } },
        { mode: { contains: 'LCN', mode: 'insensitive' } },
        { mode: { contains: 'EFFET', mode: 'insensitive' } },
      ]
    },
    include: {
      facture: {
        select: {
          numero: true,
          type: true,
          totalTTC: true
        }
      }
    }
  });
  console.log('Payments found:', JSON.stringify(payments, null, 2));

  console.log('=== Searching in TransactionBancaire ===');
  const transactions = await prisma.transactionBancaire.findMany({
    where: {
      OR: [
        { montant: { gte: 1400, lte: 1401 } },
        { description: { contains: 'LCN', mode: 'insensitive' } },
        { description: { contains: 'EFFET', mode: 'insensitive' } },
      ]
    }
  });
  console.log('Transactions found:', JSON.stringify(transactions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
