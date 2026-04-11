import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const factures = await prisma.facture.findMany({
    where: {
      type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM'] },
      statut: { notIn: ['ARCHIVE', 'ANNULEE'] }
    },
    include: {
      paiements: {
        where: { statut: { not: 'ANNULE' } }
      }
    }
  });

  let anomalyTotal = 0;
  const anomalies: any[] = [];

  for (const f of factures) {
    const totalPaiements = f.paiements.reduce((sum, p) => sum + Number(p.montant), 0);
    const reste = Number(f.resteAPayer || 0);
    const ttc = Number(f.totalTTC || 0);

    // Is it roughly equal? Encaissé + Reste = TTC
    const diff = (totalPaiements + reste) - ttc;
    
    // We only care if Diff is positive, which means Encaissé + Reste > TTC
    if (Math.abs(diff) > 0.05) {
      anomalyTotal += diff;
      anomalies.push({
        id: f.id,
        numero: f.numero,
        type: f.type,
        ttc,
        totalPaiements,
        reste,
        diff
      });
    }
  }

  console.log(`Total Surplus Anomalies: ${anomalyTotal}`);
  console.log('Top 10 Anomalies:', anomalies.sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 10));

  await prisma.$disconnect();
}
main().catch(console.error);
