import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fiche = await prisma.fiche.findFirst({
    where: { numero: 17 },
  });

  if (fiche) {
    console.log(JSON.stringify({ type: fiche.type, statut: fiche.statut }, null, 2));
  } else {
    console.log('Fiche #17 not found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
