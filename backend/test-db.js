const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const withFicheId = await prisma.facture.count({ where: { ficheId: { not: null } } });
  console.log('Factures WITH ficheId:', withFicheId);
  
  const withoutFicheId = await prisma.facture.count({ where: { ficheId: null } });
  console.log('Factures WITHOUT ficheId:', withoutFicheId);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
