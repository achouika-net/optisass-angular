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
    
    // Simuler le calcul de getOutgoingsBaseSQL pour EMISSION
    // 1. Dépenses sans echeance Id
    const d = await prisma.depense.findMany({
        where: { date: { gte: start, lte: end }, echeanceId: null }
    });
    
    // 2. Echeances liées à des factures émises en Mai
    const ep = await prisma.echeancePaiement.findMany({
        where: { 
            factureFournisseur: { dateEmission: { gte: start, lte: end } }
        },
        include: { factureFournisseur: true }
    });

    console.log('--- DETAILS DU CALCUL (ORANGE) ---');
    let totalD = 0;
    d.forEach(x => {
        console.log(`Dépense ${x.description}: ${x.montant} DH`);
        totalD += x.montant;
    });

    let totalEp = 0;
    ep.forEach(x => {
        console.log(`Echéance Fact ${x.factureFournisseur.numeroFacture} (${x.type}): ${x.montant} DH`);
        totalEp += x.montant;
    });

    console.log('TOTAL Dépenses:', totalD);
    console.log('TOTAL Echéances (Factures Mai):', totalEp);
    console.log('SOMME FINALE:', totalD + totalEp);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
