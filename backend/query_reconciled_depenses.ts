import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const depenses = await prisma.depense.findMany({
    where: { transactionBancaireId: { not: null } },
    include: { transactionBancaire: true }
  });
  console.log(JSON.stringify(depenses.map(d => ({
    id: d.id,
    date: d.date,
    montant: d.montant,
    statut: d.statut,
    transactionDate: d.transactionBancaire?.dateTransaction,
    transactionDesc: d.transactionBancaire?.description
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
