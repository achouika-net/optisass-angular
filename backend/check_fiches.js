const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fichesCount = await prisma.fiche.groupBy({
    by: ['type'],
    _count: { _all: true }
  });
  console.log('Fiches dans la DB :', fichesCount);
  
  const allFiches = await prisma.fiche.findMany({ select: { id: true, type: true, dateCreation: true } });
  console.log('Total fiches exact :', allFiches.length);
  console.log('10 premieres fiches :', allFiches.slice(0, 10));
}

main().finally(() => prisma.$disconnect());
