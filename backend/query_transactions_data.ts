import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transactionBancaire.findMany({
    take: 30,
    orderBy: { dateTransaction: 'desc' }
  });
  console.log('--- TRANSACTIONS ---');
  console.log(JSON.stringify(transactions.map(t => ({
    id: t.id,
    date: t.dateTransaction,
    description: t.description,
    type: t.type,
    montant: t.montant,
    reference: t.reference,
    statutRapprochement: t.statutRapprochement
  })), null, 2));

  const payments = await prisma.paiement.findMany({
    where: { statut: 'REMIS_EN_BANQUE' },
    take: 10
  });
  console.log('--- PAYMENTS ---');
  console.log(JSON.stringify(payments, null, 2));

  const echeances = await prisma.echeancePaiement.findMany({
    where: { statut: 'REMIS_EN_BANQUE' },
    take: 10
  });
  console.log('--- ECHEANCES ---');
  console.log(JSON.stringify(echeances, null, 2));

  const depenses = await prisma.depense.findMany({
    where: { statut: 'REMIS_EN_BANQUE' },
    take: 10
  });
  console.log('--- DEPENSES ---');
  console.log(JSON.stringify(depenses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
