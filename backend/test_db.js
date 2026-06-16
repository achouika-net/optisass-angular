const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const factures = await prisma.facture.count();
  const fiches = await prisma.fiche.count();
  const clients = await prisma.client.count();
  console.log('Factures:', factures);
  console.log('Fiches:', fiches);
  console.log('Clients:', clients);
}
main().catch(console.error).finally(() => prisma.$disconnect());
