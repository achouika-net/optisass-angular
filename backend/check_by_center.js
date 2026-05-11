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
    
    // Centres
    const centers = await prisma.centre.findMany();
    
    for (const c of centers) {
        const ff = await prisma.factureFournisseur.aggregate({
          where: { dateEmission: { gte: start, lte: end }, centreId: c.id },
          _sum: { montantTTC: true }
        });
        const d = await prisma.depense.aggregate({
          where: { date: { gte: start, lte: end }, centreId: c.id },
          _sum: { montant: true }
        });
        
        console.log(`--- CENTRE: ${c.nom} ---`);
        console.log(`Factures: ${ff._sum.montantTTC || 0}`);
        console.log(`Dépenses: ${d._sum.montant || 0}`);
        console.log(`TOTAL: ${(ff._sum.montantTTC || 0) + (d._sum.montant || 0)}`);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
