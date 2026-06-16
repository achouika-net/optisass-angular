import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const deletedTx = await prisma.transactionBancaire.deleteMany({
    where: { releveBancaireId: 'edc90751-7abb-43fd-89e2-0de59c3a9271' }
  });
  console.log(`Deleted ${deletedTx.count} transactions.`);

  const deletedReleve = await prisma.releveBancaire.delete({
    where: { id: 'edc90751-7abb-43fd-89e2-0de59c3a9271' }
  });
  console.log(`Deleted bank statement: ${deletedReleve.id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
