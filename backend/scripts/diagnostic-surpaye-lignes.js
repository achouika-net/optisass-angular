const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const factures = await prisma.facture.findMany({
    where: { type: { notIn: ['AVOIR', 'DEVIS'] } },
    select: {
      id: true,
      numero: true,
      totalTTC: true,
      resteAPayer: true,
      statut: true,
      lignes: true,
      paiements: {
        where: { montant: { gt: 0 } },
        select: { id: true, montant: true }
      }
    }
  });

  const anomalies = [];
  for (const f of factures) {
    const totalPaye = f.paiements.reduce((s, p) => s + p.montant, 0);
    const surpaye = totalPaye - f.totalTTC;
    
    if (surpaye > 1) { // Error of > 1 DH
      // Try to calculate TTC from lignes
      let calcTTC = 0;
      if (Array.isArray(f.lignes)) {
        for (const l of f.lignes) {
          // Ligne structure can vary, usually properties like totalTTC, prixTTC * quantite
          const rowTTC = l.totalTTC || (l.prixTTC * (l.quantite || 1)) || 0;
          calcTTC += parseFloat(rowTTC) || 0;
        }
      }

      anomalies.push({
        id: f.id,
        numero: f.numero,
        totalTTC: f.totalTTC,
        calcTTC: calcTTC,
        totalPaye: totalPaye,
        surpaye: surpaye,
        lignesCount: Array.isArray(f.lignes) ? f.lignes.length : 0
      });
    }
  }

  anomalies.sort((a, b) => b.surpaye - a.surpaye); // Sort by highest surplus

  console.log(`=== TOP 10 FACTURES SURPAYEES ===`);
  for (const a of anomalies.slice(0, 10)) {
    console.log(`${a.numero} | TTC BD: ${a.totalTTC.toFixed(2)} | TTC Calculé JSON: ${a.calcTTC.toFixed(2)} | Payé: ${a.totalPaye.toFixed(2)} | Surpaye: ${a.surpaye.toFixed(2)} | Nb lignes JSON: ${a.lignesCount}`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
