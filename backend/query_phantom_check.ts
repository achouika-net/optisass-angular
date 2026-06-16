import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const fiches = await prisma.fiche.findMany({
    where: { numero: { in: [12364, 12525, 12621, 12065, 12470] } },
    include: { facture: true }
  });

  console.log('=== Phantom Fiches in DB ===');
  console.log(JSON.stringify(fiches, null, 2));
}

main().catch(console.error).finally(() => prisma['']());
