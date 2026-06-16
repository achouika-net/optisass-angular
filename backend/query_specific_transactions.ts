import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transactionBancaire.findMany({
    where: {
      OR: [
        { description: { contains: 'C.ENT', mode: 'insensitive' } },
        { description: { contains: 'RMAHALI', mode: 'insensitive' } },
        { montant: 121.00 },
        { montant: 3.04 }
      ]
    }
  });
  console.log(JSON.stringify(transactions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
