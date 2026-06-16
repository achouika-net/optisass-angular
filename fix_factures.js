const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  console.log("Starting fix...");
  const factures = await prisma.facture.findMany({
    where: { totalTTC: 0, ficheId: { not: null } },
    include: { 
      fiche: { select: { montantTotal: true } },
      paiements: { select: { montant: true } }
    }
  });
  console.log(`Found ${factures.length} factures with totalTTC = 0 and linked to a fiche`);
  let fixedCount = 0;
  for (const f of factures) {
    if (f.fiche && f.fiche.montantTotal > 0) {
      const totalAmount = f.fiche.montantTotal;
      const totalHT = totalAmount / 1.2;
      const totalTVA = totalAmount - totalHT;
      const totalPaye = f.paiements.reduce((sum, p) => sum + p.montant, 0);
      const resteAPayer = Math.max(0, totalAmount - totalPaye);
      let statut = f.statut;
      if (f.type === 'FACTURE' && resteAPayer <= 0) statut = 'PAYEE';
      else if (f.type === 'FACTURE' && resteAPayer > 0 && f.statut === 'PAYEE') statut = 'VALIDE';

      await prisma.facture.update({
        where: { id: f.id },
        data: {
          totalTTC: totalAmount,
          totalHT,
          totalTVA,
          resteAPayer,
          statut
        }
      });
      fixedCount++;
    }
  }
  console.log(`Successfully fixed ${fixedCount} factures.`);
}
run().catch(console.error).finally(() => prisma.$disconnect());
