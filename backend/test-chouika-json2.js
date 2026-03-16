const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const client = await prisma.client.findFirst({
    where: { nom: { contains: 'CHOUIKA' } }
  });
  if(!client) return console.log('not found');
  const fiches = await prisma.fiche.findMany({
    where: { clientId: client.id }
  });
  const res = [];
  for (const f of fiches) {
    const factures = await prisma.facture.findMany({
      where: { ficheId: f.id }
    });
    res.push({
      ficheId: f.id,
      date: f.createdAt,
      type: f.type,
      factures: factures
    });
  }
  require('fs').writeFileSync('chouika.json', JSON.stringify(res, null, 2));
}
main().finally(() => prisma.$disconnect());
