const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
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
          // Depending on the version of the app, line total might be totalTTC or prixTTC * qty.
          const isLentille = l.type === 'LENTILLE';
          let rowTTC = l.totalTTC || (l.prixTTC * (l.quantite || 1)) || 0;
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

  let out = `=== TOP 20 FACTURES SURPAYEES ===\n`;
  for (const a of anomalies.slice(0, 20)) {
    out += `${a.numero} | TTC BD: ${a.totalTTC.toFixed(2)} | TTC JSON: ${a.calcTTC.toFixed(2)} | Payé: ${a.totalPaye.toFixed(2)} | Surpaye: ${a.surpaye.toFixed(2)}\n`;
  }
  
  fs.writeFileSync('C:\\Users\\ASUS\\.\\.gemini\\antigravity\\playground\\golden-cluster\\backend\\diag-out.txt', out, 'utf8');
}

run().catch(console.error).finally(() => prisma.$disconnect());
