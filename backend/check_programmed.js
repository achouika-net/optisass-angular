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
    
    // Factures avec paiements
    const ffWithEp = await prisma.factureFournisseur.findMany({
      where: { 
        dateEmission: { gte: start, lte: end },
        echeances: { some: {} }
      },
      include: { echeances: true }
    });
    
    let totalFfWithEp = 0;
    ffWithEp.forEach(f => totalFfWithEp += f.montantTTC);

    // Dépenses directes (en général elles sont payées)
    const d = await prisma.depense.aggregate({
      where: { date: { gte: start, lte: end } },
      _sum: { montant: true }
    });

    console.log('Factures avec paiement:', totalFfWithEp);
    console.log('Dépenses directes:', d._sum.montant);
    console.log('TOTAL (Orange attendu):', totalFfWithEp + (d._sum.montant || 0));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
