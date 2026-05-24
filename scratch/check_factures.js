const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const factures = await prisma.facture.findMany({
      take: 3,
      where: {
        lignes: { not: null }
      }
    });
    
    factures.forEach(f => {
      console.log(`Facture ${f.numero}:`);
      console.log(JSON.stringify(f.lignes, null, 2));
    });
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
