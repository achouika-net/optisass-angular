const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const factures = await prisma.facture.aggregate({ 
    where: { type: { notIn: ['AVOIR','DEVIS'] } }, 
    _sum: { totalTTC: true }, 
    _count: true 
  });
  const paiementsPos = await prisma.paiement.aggregate({ 
    where: { montant: { gt: 0 } }, 
    _sum: { montant: true }, 
    _count: true 
  });
  const paiementsNeg = await prisma.paiement.aggregate({ 
    where: { montant: { lt: 0 } }, 
    _sum: { montant: true }, 
    _count: true 
  });
  const impayees = await prisma.facture.aggregate({ 
    where: { type: { notIn: ['AVOIR','DEVIS'] }, resteAPayer: { gt: 0.01 } }, 
    _sum: { resteAPayer: true }, 
    _count: true 
  });

  const ttc = factures._sum.totalTTC || 0;
  const enc = paiementsPos._sum.montant || 0;
  const avr = Math.abs(paiementsNeg._sum.montant || 0);
  const rst = impayees._sum.resteAPayer || 0;
  const ecart = ttc - enc;
  const ecartInexplique = ttc - enc - rst;

  const lines = [
    '=== RECONCILIATION VENTES vs ENCAISSEMENTS ===',
    `Nb factures:       ${factures._count}  | Total TTC:      ${ttc.toFixed(2)} DH`,
    `Nb paiements:      ${paiementsPos._count}  | Total encaisse: ${enc.toFixed(2)} DH`,
    `Avoirs/rembt:      ${paiementsNeg._count}  | Total avoirs:   ${avr.toFixed(2)} DH`,
    `Factures impayees: ${impayees._count}  | Reste a payer:  ${rst.toFixed(2)} DH`,
    '----------------------------------------------',
    `ECART brut (TTC - Enc):       ${ecart.toFixed(2)} DH`,
    `ECART inexplique (aprés reste): ${ecartInexplique.toFixed(2)} DH`,
    Math.abs(ecartInexplique) < 5 
      ? 'VERDICT: OK - Tout balance' 
      : ecartInexplique > 5 
        ? `VERDICT: ATTENTION - ${ecartInexplique.toFixed(2)} DH non encaisse`
        : `VERDICT: ANOMALIE - Encaisse PLUS que facture de ${Math.abs(ecartInexplique).toFixed(2)} DH`,
  ];
  lines.forEach(l => process.stdout.write(l + '\n'));
}

run().catch(console.error).finally(() => prisma.$disconnect());
