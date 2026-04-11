import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- DEBUT DU NETTOYAGE DES ANOMALIES DE CAISSE ---');

  const factures = await prisma.facture.findMany({
    where: {
      type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR'] },
      statut: { notIn: ['ARCHIVE', 'ANNULEE'] }
    },
    include: {
      paiements: {
        where: { statut: { not: 'ANNULE' } }
      }
    }
  });

  let fixedResteCount = 0;
  let fixedOverpaymentCount = 0;

  for (const f of factures) {
    const totalPaiements = f.paiements.reduce((sum, p) => sum + Number(p.montant), 0);
    const currentReste = Number(f.resteAPayer || 0);
    const ttc = Number(f.totalTTC || 0);

    const diff = (totalPaiements + currentReste) - ttc;

    if (Math.abs(diff) > 0.05) {
      const correctReste = Math.max(0, ttc - totalPaiements);
      
      // 1. Fix wrong Reste à Payer
      if (Math.abs(currentReste - correctReste) > 0.05) {
        await prisma.facture.update({
          where: { id: f.id },
          data: { resteAPayer: correctReste }
        });
        fixedResteCount++;
        console.log(`[RESTE FIX] ${f.numero}: Reste corrigé de ${currentReste} -> ${correctReste}`);
      }

      // 2. Fix Overpayments (Paiements > TTC)
      if (totalPaiements > ttc + 0.05) {
        const overpaymentAmount = totalPaiements - ttc;
        // Créer un décaissement compensatoire pour équilibrer la caisse
        await prisma.paiement.create({
          data: {
            factureId: f.id,
            montant: -overpaymentAmount,
            mode: 'AUTRE',
            statut: 'DECAISSEMENT',
            date: new Date(),
            notes: 'Ajustement auto - Correction surplus import historique',
          }
        });
        
        let targetStatut = f.statut;
        if (targetStatut !== 'PAYEE' && f.type === 'FACTURE') {
          targetStatut = 'PAYEE';
        }

        await prisma.facture.update({
          where: { id: f.id },
          data: { statut: targetStatut }
        });
        
        fixedOverpaymentCount++;
        console.log(`[OVERPAYMENT FIX] ${f.numero}: Décaissement créé de -${overpaymentAmount} DH`);
      }
    }
  }

  console.log('--- FIN DU NETTOYAGE ---');
  console.log(`Bilan: ${fixedResteCount} Restes à Payer corrigés, ${fixedOverpaymentCount} Sur-paiements ajustés.`);

  await prisma.$disconnect();
}
main().catch(console.error);
