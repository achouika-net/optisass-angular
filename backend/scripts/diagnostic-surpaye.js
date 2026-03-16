const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Paiements dont le montant dépasse le resteAPayer INITIAL de la facture
  // On cherche les factures où : SUM(paiements) > totalTTC
  const factures = await prisma.facture.findMany({
    where: { type: { notIn: ['AVOIR', 'DEVIS'] } },
    select: {
      id: true,
      numero: true,
      totalTTC: true,
      resteAPayer: true,
      statut: true,
      paiements: {
        where: { montant: { gt: 0 } },
        select: { id: true, montant: true, mode: true, date: true }
      }
    }
  });

  const anomalies = [];
  for (const f of factures) {
    const totalPaye = f.paiements.reduce((s, p) => s + p.montant, 0);
    const surpaye = totalPaye - f.totalTTC;
    if (surpaye > 1) { // tolérance 1 DH pour flottants
      anomalies.push({
        facture: f.numero,
        totalTTC: f.totalTTC.toFixed(2),
        totalPaye: totalPaye.toFixed(2),
        surpaye: surpaye.toFixed(2),
        nbPaiements: f.paiements.length,
        statut: f.statut
      });
    }
  }

  process.stdout.write(`\n=== FACTURES SURPAYÉES (${anomalies.length}) ===\n`);
  let totalSurpaye = 0;
  anomalies.forEach(a => {
    totalSurpaye += parseFloat(a.surpaye);
    process.stdout.write(`${a.facture} | TTC:${a.totalTTC} | Payé:${a.totalPaye} | Surplus:+${a.surpaye} DH | ${a.nbPaiements} pmt | ${a.statut}\n`);
  });
  process.stdout.write(`\nTOTAL SURPLUS: ${totalSurpaye.toFixed(2)} DH\n`);

  // Aussi: paiements dont la facture n'existe pas (normalement impossible avec FK mais on vérifie)
  const allPaiements = await prisma.paiement.findMany({
    where: { montant: { gt: 0 } },
    select: { id: true, montant: true, factureId: true, mode: true, date: true, facture: { select: { id: true } } }
  });
  const sansFact = allPaiements.filter(p => !p.facture);
  process.stdout.write(`\n=== PAIEMENTS SANS FACTURE: ${sansFact.length} ===\n`);
  sansFact.slice(0, 10).forEach(p => {
    process.stdout.write(`ID:${p.id} | ${p.montant} DH | ${p.mode} | ${p.date?.toISOString?.()?.slice(0,10)}\n`);
  });
}

run().catch(console.error).finally(() => prisma.$disconnect());
