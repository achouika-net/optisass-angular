import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const invoice = await prisma.facture.findFirst({
      where: { numero: 'BC-2026-031' },
      include: { fiche: true }
    });
    console.log('--- INVOICE ---');
    console.log(JSON.stringify(invoice, null, 2));
    
    if (invoice?.lignes) {
      const lines = typeof invoice.lignes === 'string' ? JSON.parse(invoice.lignes) : invoice.lignes;
      console.log('--- LINES ---');
      console.log(JSON.stringify(lines, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
