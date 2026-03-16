const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanUpReconciliation() {
  console.log('🧹 [1/2] RESTAURATION DES TTC DES BONS DE COMMANDE À 0,00 DH...');
  const facturesA0 = await prisma.facture.findMany({
    where: { 
      type: { notIn: ['AVOIR', 'DEVIS'] },
      totalTTC: 0,
      paiements: { some: {} }
    },
    select: { id: true, numero: true, lignes: true, totalTTC: true }
  });

  let fixedTTC = 0;
  for (const f of facturesA0) {
    if (Array.isArray(f.lignes) && f.lignes.length > 0) {
      let calcTTC = 0;
      let calcHT = 0;
      
      for (const l of f.lignes) {
        const rowTTC = l.totalTTC || (l.prixTTC * (l.quantite || 1)) || 0;
        const rowHT = l.totalHT || (l.prixHT * (l.quantite || 1)) || 0;
        calcTTC += parseFloat(rowTTC) || 0;
        calcHT += parseFloat(rowHT) || 0;
      }
      
      if (calcTTC > 0) {
        const paiements = await prisma.paiement.aggregate({
          where: { factureId: f.id, montant: { gt: 0 } },
          _sum: { montant: true }
        });
        const totalPaye = paiements._sum.montant || 0;
        const nouveauReste = Math.max(0, calcTTC - totalPaye);
        const nouveauStatut = nouveauReste === 0 ? 'PAYEE' : 'PARTIEL';

        await prisma.facture.update({
          where: { id: f.id },
          data: {
            totalHT: calcHT,
            totalTTC: calcTTC,
            resteAPayer: nouveauReste,
            statut: nouveauStatut
          }
        });
        console.log(`  ✅ ${f.numero} réparé : TTC passé de 0 à ${calcTTC.toFixed(2)} DH (Reste: ${nouveauReste.toFixed(2)} DH)`);
        fixedTTC++;
      }
    }
  }
  console.log(`\n  👉 ${fixedTTC} factures/BCs réparées cette fois-ci.\n`);

  console.log('🧹 [2/2] NETTOYAGE DES PAIEMENTS DOUBLONS PARFAITS...');
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

  let deletedDuplicatesCount = 0;
  let deletedDuplicatesAmount = 0;

  for (const f of overpaidFactures) {
    const totalPaye = f.paiements.reduce((s, p) => s + p.montant, 0);
    const surpaye = totalPaye - f.totalTTC;
    
    if (surpaye >= 1 && f.paiements.length > 1) {
      const seen = new Set();
      const duplicateIdsToDelete = [];
      
      for (const p of f.paiements) {
        // Group by day + mode + exact amount (safest to detect double-clicks)
        const dateRounded = new Date(p.date).toISOString().slice(0, 10);
        const signature = `${p.montant}-${p.mode}-${dateRounded}`;
        
        if (seen.has(signature)) { 
          duplicateIdsToDelete.push(p);
        } else {
          seen.add(signature);
        }
      }

      let currentSurpaye = surpaye;
      for (const dup of duplicateIdsToDelete) {
        if (currentSurpaye >= dup.montant - 0.5) {
          console.log(`  🗑️  Suppression doublon sur ${f.numero} : ${dup.montant} DH en ${dup.mode} (ID: ${dup.id.substring(0,8)})`);
          
          if (dup.operationCaisseId) {
            await prisma.operationCaisse.delete({ where: { id: dup.operationCaisseId } });
          }
          await prisma.paiement.delete({ where: { id: dup.id } });
          
          // Re-adjust
          const freshPaiements = await prisma.paiement.aggregate({
            where: { factureId: f.id, montant: { gt: 0 } },
            _sum: { montant: true }
          });
          const newTotalPaye = freshPaiements._sum.montant || 0;
          const newReste = Math.max(0, f.totalTTC - newTotalPaye);
          
          await prisma.facture.update({
            where: { id: f.id },
            data: { resteAPayer: newReste, statut: newReste <= 0 ? (f.totalTTC > 0 ? 'PAYEE' : 'VALIDE') : 'PARTIEL' }
          });

          currentSurpaye -= dup.montant;
          deletedDuplicatesCount++;
          deletedDuplicatesAmount += dup.montant;
        }
      }
    }
  }

  console.log(`\n  👉 ${deletedDuplicatesCount} paiements en doublon (double-clics) supprimés.`);
  console.log(`  👉 Total historique récupéré (effacé de l'encaissé en trop) : ${deletedDuplicatesAmount.toFixed(2)} DH.\n`);
  
  console.log('✅ NETTOYAGE COMPLET TERMINÉ.');
}

cleanUpReconciliation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
