import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.groupe.findMany({
    select: { id: true, nom: true, type: true },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(groups);
}

main().finally(() => prisma.$disconnect());
