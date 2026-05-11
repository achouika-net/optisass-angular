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
    const end = new Date('2026-05-31T23:59:59Z');
    
    // Echeances de Mai
    const ep = await prisma.echeancePaiement.findMany({
      where: { dateEcheance: { gte: start, lte: end } }
    });
    
    let paid = 0;
    let pending = 0;
    ep.forEach(e => {
      if (['PAYEE', 'ENCAISSE', 'VALIDE'].includes(e.statut.toUpperCase())) paid += e.montant;
      else pending += e.montant;
    });

    console.log('Echéances Mai - Déjà Payé:', paid);
    console.log('Echéances Mai - En attente:', pending);
    console.log('Total Echéances Mai:', paid + pending);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
