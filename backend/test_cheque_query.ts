import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const normalizedCentreId = 'cacd3b5c-96c6-49a0-ad5d-70b6560ce419';
  const paidStatuses = [
    'ENCAISSE',
    'ENCAISSE\u0025',
    'ENCAISSE\u0025E',
    'PAYE',
    'PAYE\u0025',
    'PAYEE',
    'PAYE\u0025E',
    'VALIDE',
    'VALIDE\u0025',
    'VALIDE\u0025E',
    'SOLDE',
    'SOLDE\u0025',
    'SOLDE\u0025E',
    'DECAISSE',
    'DECAISSE\u0025',
    'DECAISSEMENT',
  ];

  console.log('--- TEST 1: All payments count and sum for centre ---');
  const inStats = await prisma.paiement.aggregate({
    where: {
      facture: { centreId: normalizedCentreId },
    },
    _sum: { montant: true },
    _count: { _all: true },
  });
  console.log(JSON.stringify(inStats, null, 2));

  console.log('--- TEST 2: Paid status filter ---');
  const inPaidStats = await prisma.paiement.aggregate({
    where: {
      facture: { centreId: normalizedCentreId },
      statut: { in: paidStatuses },
    },
    _sum: { montant: true },
    _count: { _all: true },
  });
  console.log(JSON.stringify(inPaidStats, null, 2));

  console.log('--- TEST 3: Cheque count and sum ---');
  const inChequeStats = await prisma.paiement.aggregate({
    where: {
      facture: { centreId: normalizedCentreId },
      mode: { in: ['CHEQUE', 'CH\u00C8QUE', 'CH\u00CAQUE', 'CH\u00C9QUE', 'CH^QUE'] },
    },
    _sum: { montant: true },
    _count: { _all: true },
  });
  console.log(JSON.stringify(inChequeStats, null, 2));

  console.log('--- TEST 4: Cheque with paid status filter ---');
  const inChequePaidStats = await prisma.paiement.aggregate({
    where: {
      facture: { centreId: normalizedCentreId },
      statut: { in: paidStatuses },
      mode: { in: ['CHEQUE', 'CH\u00C8QUE', 'CH\u00CAQUE', 'CH\u00C9QUE', 'CH^QUE'] },
    },
    _sum: { montant: true },
    _count: { _all: true },
  });
  console.log(JSON.stringify(inChequePaidStats, null, 2));

  // Let's print all unique payment statuses in database
  const statuses = await prisma.paiement.groupBy({
    by: ['statut'],
    _count: { _all: true }
  });
  console.log('=== Statuses in DB ===', JSON.stringify(statuses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
