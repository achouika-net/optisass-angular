const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.mouvementStock.findMany({
  where: { type: 'SORTIE_VENTE' },
  orderBy: { dateMovement: 'desc' },
  take: 5
}).then(console.log).finally(() => prisma.$disconnect());
