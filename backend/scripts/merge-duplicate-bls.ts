import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all BonLivraison records...');
  const allBLs = await prisma.bonLivraison.findMany({
    include: {
      echeances: true,
      depense: true,
      mouvementsStock: true
    }
  });

  console.log(`Fetched ${allBLs.length} BL records. Processing...`);

  // Group BLs by supplier and base number
  const groups = new Map<string, any[]>();
  for (const bl of allBLs) {
    const baseNum = bl.numeroBL.split('_')[0];
    const key = `${bl.fournisseurId}|${baseNum}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(bl);
  }

  let mergedGroupsCount = 0;
  let deletedRecordsCount = 0;

  for (const [key, group] of groups.entries()) {
    if (group.length <= 1) continue;

    // Sort: base BL first (no underscore in numeroBL), then by name
    group.sort((a, b) => {
      const aHasUnderscore = a.numeroBL.includes('_');
      const bHasUnderscore = b.numeroBL.includes('_');
      if (aHasUnderscore && !bHasUnderscore) return 1;
      if (!aHasUnderscore && bHasUnderscore) return -1;
      return a.numeroBL.localeCompare(b.numeroBL);
    });

    const primary = group[0];
    const duplicates = group.slice(1);

    // Determine if all amounts in the group are identical
    const firstAmount = group[0].montantTTC;
    const allIdentical = group.every(b => Math.abs(b.montantTTC - firstAmount) < 0.01);

    let finalHT = primary.montantHT;
    let finalTVA = primary.montantTVA;
    let finalTTC = primary.montantTTC;

    if (!allIdentical) {
      // Sum the amounts
      finalHT = group.reduce((sum, b) => sum + b.montantHT, 0);
      finalTVA = group.reduce((sum, b) => sum + b.montantTVA, 0);
      finalTTC = group.reduce((sum, b) => sum + b.montantTTC, 0);
    }

    // Update primary BL if amount changed
    if (!allIdentical) {
      await prisma.bonLivraison.update({
        where: { id: primary.id },
        data: {
          montantHT: finalHT,
          montantTVA: finalTVA,
          montantTTC: finalTTC
        }
      });
    }

    // Re-link relations
    for (const dup of duplicates) {
      // Re-link MouvementStock
      await prisma.mouvementStock.updateMany({
        where: { bonLivraisonId: dup.id },
        data: { bonLivraisonId: primary.id }
      });

      // Re-link EcheancePaiement
      await prisma.echeancePaiement.updateMany({
        where: { bonLivraisonId: dup.id },
        data: { bonLivraisonId: primary.id }
      });

      // Re-link Depense
      await prisma.depense.updateMany({
        where: { bonLivraisonId: dup.id },
        data: { bonLivraisonId: primary.id }
      });

      // Delete the duplicate BL
      await prisma.bonLivraison.delete({
        where: { id: dup.id }
      });

      deletedRecordsCount++;
    }

    mergedGroupsCount++;
  }

  console.log(`Merge completed successfully!`);
  console.log(`Merged ${mergedGroupsCount} duplicate groups.`);
  console.log(`Deleted ${deletedRecordsCount} duplicate BL records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
