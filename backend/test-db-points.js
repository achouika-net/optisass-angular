const { PrismaClient } = require('@prisma/client');

async function test() {
  const prisma = new PrismaClient();
  const factures = await prisma.facture.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  for (const f of factures) {
    console.log(`Document: ${f.numero || f.id} | Type: ${f.type} | Statut: ${f.statut}`);
    console.log(`Proprietes: ${JSON.stringify(f.proprietes)}`);
  }
  
  await prisma.$disconnect();
}

test().catch(e => console.error(e));
