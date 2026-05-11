const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
    }
  }
});

async function main() {
  try {
    const start = new Date('2026-05-01');
    const today = new Date('2026-05-11T23:59:59Z');
    
    // Echeances jusqu'à aujourd'hui
    const ep = await prisma.echeancePaiement.aggregate({
      where: { dateEcheance: { gte: start, lte: today } },
      _sum: { montant: true }
    });
    
    console.log('Total Echéances au 11 Mai:', ep._sum.montant);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
