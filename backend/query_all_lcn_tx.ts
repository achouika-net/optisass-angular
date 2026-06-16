import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== ALL LCN / EFFET BANK TRANSACTIONS ===');
  const txs = await prisma.transactionBancaire.findMany({
    where: {
      OR: [
        { typeTransaction: 'LCN' },
        { description: { contains: 'LCN', mode: 'insensitive' } },
        { description: { contains: 'EFFET', mode: 'insensitive' } },
      ]
    }
  });
  console.log(`Count of LCN transactions: ${txs.length}`);
  const txWith1400 = txs.filter(t => String(t.montant).includes('1400'));
  console.log('LCN transactions containing 1400:', JSON.stringify(txWith1400, null, 2));

  // Let's print all unique LCN transaction amounts
  const amounts = new Set(txs.map(t => t.montant));
  console.log('LCN transaction amounts:', Array.from(amounts).sort((a,b) => a-b));

  console.log('=== ALL PAYMENTS CONTAINING LCN / EFFET IN ANY FIELD ===');
  const payments = await prisma.paiement.findMany({
    where: {
      OR: [
        { mode: { contains: 'LCN', mode: 'insensitive' } },
        { mode: { contains: 'EFFET', mode: 'insensitive' } },
        { reference: { contains: 'LCN', mode: 'insensitive' } },
        { reference: { contains: 'EFFET', mode: 'insensitive' } },
        { notes: { contains: 'LCN', mode: 'insensitive' } },
        { notes: { contains: 'EFFET', mode: 'insensitive' } },
      ]
    }
  });
  console.log(`Count of LCN/EFFET payments: ${payments.length}`);
  if (payments.length > 0) {
    console.log('Payments:', JSON.stringify(payments, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
