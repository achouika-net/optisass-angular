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
    
    // 1. Factures émises en Mai
    const ff = await prisma.factureFournisseur.aggregate({
      where: { dateEmission: { gte: start, lte: end } },
      _sum: { montantTTC: true }
    });
    
    // 2. Dépenses directes en Mai
    const d = await prisma.depense.aggregate({
      where: { date: { gte: start, lte: end } },
      _sum: { montant: true }
    });
    
    // 3. Échéances de paiement en Mai
    const ep = await prisma.echeancePaiement.aggregate({
      where: { dateEcheance: { gte: start, lte: end } },
      _sum: { montant: true }
    });

    console.log('--- TOTAUX MAI 2026 ---');
    console.log('Factures (Emission):', ff._sum.montantTTC);
    console.log('Dépenses Directes:', d._sum.montant);
    console.log('Total Engagé (Accrual):', (ff._sum.montantTTC || 0) + (d._sum.montant || 0));
    console.log('Échéances (Cash Flow):', ep._sum.montant);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
