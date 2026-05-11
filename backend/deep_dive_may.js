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
    
    // Factures de Mai avec leurs échéances
    const ff = await prisma.factureFournisseur.findMany({
      where: { dateEmission: { gte: start, lte: end } },
      include: { echeances: true }
    });

    console.log('--- DETAILS FACTURES MAI 2026 ---');
    let totalRestant = 0;
    let totalPaye = 0;

    ff.forEach(f => {
        let paye = 0;
        f.echeances.forEach(e => {
            if (['PAYEE', 'ENCAISSE', 'VALIDE'].includes(e.statut.toUpperCase())) paye += e.montant;
        });
        const restant = f.montantTTC - paye;
        console.log(`Facture ${f.numeroFacture}: TTC=${f.montantTTC}, Payé=${paye}, Restant=${restant}`);
        totalRestant += restant;
        totalPaye += paye;
    });

    console.log('\n--- BILAN ---');
    console.log('Total Payé sur factures Mai:', totalPaye);
    console.log('Total Restant sur factures Mai:', totalRestant);
    console.log('Total Dépenses directes:', 1930);
    console.log('Total Payé + Dépenses:', totalPaye + 1930);
    console.log('Total Restant + Dépenses:', totalRestant + 1930);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
