import { PrismaClient } from '@prisma/client';

async function check() {
  const prisma = new PrismaClient();
  const factures = await prisma.facture.findMany({
    take: 5,
    where: { lignes: { not: Prisma.JsonNull } }
  });
  console.log(JSON.stringify(factures.map(f => ({ id: f.id, lignes: f.lignes })), null, 2));
  await prisma.$disconnect();
}

check();
