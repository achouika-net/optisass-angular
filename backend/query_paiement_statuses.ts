import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const statuses = await prisma.paiement.groupBy({
    by: ['statut'],
    _count: true
  });
  console.log(JSON.stringify(statuses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
