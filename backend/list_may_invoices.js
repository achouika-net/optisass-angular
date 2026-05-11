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
    
    // Factures émises en Mai
    const ff = await prisma.factureFournisseur.findMany({
      where: { dateEmission: { gte: start, lte: end } },
      select: { numeroFacture: true, montantTTC: true, type: true, fournisseur: { select: { nom: true } } }
    });

    console.log('--- FACTURES DE MAI 2026 ---');
    let total = 0;
    ff.forEach(f => {
      console.log(`Facture ${f.numeroFacture} (${f.fournisseur?.nom}): ${f.montantTTC} DH`);
      total += f.montantTTC;
    });
    console.log('TOTAL Factures:', total);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
