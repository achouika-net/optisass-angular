import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const echeance = await prisma.echeancePaiement.findUnique({
    where: { id: 'fe7420d6-0cee-44a8-9443-776b90739d42' },
    include: { depense: true }
  });
  console.log('Echeance:', JSON.stringify(echeance, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
