const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const start = new Date('2026-04-01T00:00:00Z');
  const end = new Date('2026-04-30T23:59:59Z');
  const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36'; // Centre Rabat

  console.log('--- OPERATIONAL EXPENSES (Depense table) ---');
  const depenses = await prisma.depense.findMany({
    where: { date: { gte: start, lte: end }, centreId }
  });
  console.log(JSON.stringify(depenses, null, 2));

  console.log('--- SUPPLIER INVOICES (NON-STOCK) ---');
  const invoices = await prisma.factureFournisseur.findMany({
    where: { 
      dateEmission: { gte: start, lte: end }, 
      centreId,
      type: { notIn: ['ACHAT_STOCK', 'ACHAT_STOCK_DIVERS', 'ACHAT_MONTURE', 'ACHAT_VERRE_OPTIQUE', 'ACHAT_LENTILLE', 'ACHAT_ACCESSOIRE'] }
    }
  });
  console.log(JSON.stringify(invoices, null, 2));

  console.log('--- SUPPLIER INVOICES (STOCK) ---');
  const stockInvoices = await prisma.factureFournisseur.findMany({
    where: { 
      dateEmission: { gte: start, lte: end }, 
      centreId,
      type: { in: ['ACHAT_STOCK', 'ACHAT_STOCK_DIVERS', 'ACHAT_MONTURE', 'ACHAT_VERRE_OPTIQUE', 'ACHAT_LENTILLE', 'ACHAT_ACCESSOIRE'] }
    }
  });
  console.log(JSON.stringify(stockInvoices, null, 2));

  await prisma.$disconnect();
}

run();
