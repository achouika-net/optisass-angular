const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanUpSurplusForceful() {
  console.log('🧹 RECHERCHE ET SUPPRESSION DES SURPLUS (PAIEMENTS MULTIPLES)...');

  const overpaidFactures = await prisma.facture.findMany({
    where: { type: { notIn: ['AVOIR', 'DEVIS'] } },
    select: {
      id: true,
      numero: true,
      totalTTC: true,
      paiements: {
        where: { montant: { gt: 0 } },
        orderBy: { date: 'asc' },
        select: { id: true, montant: true, mode: true, date: true, operationCaisseId: true }
      }
    }
  });

  let deletedCount = 0;
  let deletedAmount = 0;

  for (const f of overpaidFactures) {
    const totalPaye = f.paiements.reduce((s, p) => s + p.montant, 0);
    const surpaye = totalPaye - f.totalTTC;
    
    // Si la facture est surpayée de plus de 1 DH, et qu'il y a plus d'1 paiement
    if (surpaye >= 1 && f.paiements.length > 1) {
      console.log(`\n❌ ANOMALIE DÉTECTÉE: ${f.numero} | TTC: ${f.totalTTC} | Payé: ${totalPaye} | Surpaye: ${surpaye.toFixed(2)} DH`);
      
      let currentSurpaye = surpaye;
      
      // On prend les paiements les PLUS RÉCENTS (ceux en fin de liste) et on les supprime 
      // si leur suppression ne fait pas passer le solde en dessous du TTC.
      const paiementsReverse = [...f.paiements].reverse();
      
      for (const p of paiementsReverse) {
        // On supprime ce paiement s'il est un surplus clair (ex: 2x le montant TTC, le dernier est de trop)
        // Ou si c'est un montant partiel qui correspond exactement à ce qui dépasse
        if (currentSurpaye >= p.montant - 0.5) {
          console.log(`  🗑️ SUPPRESSION PAIEMENT EN TROP: ${p.montant} DH (Mode: ${p.mode})`);
          
          await prisma.$transaction(async (tx) => {
            if (p.operationCaisseId) {
              await tx.operationCaisse.delete({ where: { id: p.operationCaisseId } });
            }
            await tx.paiement.delete({ where: { id: p.id } });
            
            // Re-calcul du Reste A Payer
            const freshPaiements = await tx.paiement.aggregate({
              where: { factureId: f.id, montant: { gt: 0 } },
              _sum: { montant: true }
            });
            const newTotalPaye = freshPaiements._sum.montant || 0;
            const newReste = Math.max(0, f.totalTTC - newTotalPaye);
            
            await tx.facture.update({
              where: { id: f.id },
              data: { resteAPayer: newReste, statut: newReste <= 0 ? (f.totalTTC > 0 ? 'PAYEE' : 'VALIDE') : 'PARTIEL' }
            });
          });

          currentSurpaye -= p.montant;
          deletedCount++;
          deletedAmount += p.montant;
        }
      }
    }
  }

  console.log(`\n✅ NETTOYAGE TERMINÉ.`);
  console.log(`👉 Paiements excédentaires supprimés: ${deletedCount}`);
  console.log(`👉 Somme totale récupérée: ${deletedAmount.toFixed(2)} DH\n`);
}

cleanUpSurplusForceful()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
