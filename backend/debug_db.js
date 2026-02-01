const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const depenses = await prisma.depense.findMany({
    where: { categorie: { contains: 'LOYER', mode: 'insensitive' } },
    orderBy: { date: 'asc' }
  });
  console.log('--- LOYER ---');
  depenses.forEach(d => {
    console.log('ID:', d.id, 'Date:', d.date.toISOString(), 'Amount:', d.montant);
  });
}
main().catch(console.error).finally(() => prisma.\());
