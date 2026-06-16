import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== STARTING DATABASE CLEANUP ===');

  const nums = [12364, 12525, 12621, 12065, 12470];

  // 1. Delete phantom fiches and factures
  for (const num of nums) {
    const fiche = await prisma.fiche.findFirst({
      where: { numero: num },
      include: { facture: true }
    });

    if (fiche) {
      console.log(`Deleting Fiche ${num} (ID: ${fiche.id}) and Facture ${fiche.facture?.numero || 'none'}...`);
      if (fiche.facture) {
        // Cascade will delete payments associated with the facture
        await prisma.facture.delete({
          where: { id: fiche.facture.id }
        });
      }
      await prisma.fiche.delete({
        where: { id: fiche.id }
      });
    } else {
      console.log(`Fiche ${num} not found.`);
    }
  }

  // 2. Convert Devis 16935 to BON_COMMANDE
  const devisNum = '16935';
  const devis = await prisma.facture.findFirst({
    where: { numero: devisNum, type: 'DEVIS' }
  });

  if (devis) {
    console.log(`Converting Devis ${devisNum} to BON_COMMANDE with status VENTE_EN_INSTANCE...`);
    await prisma.facture.update({
      where: { id: devis.id },
      data: {
        type: 'BON_COMMANDE',
        statut: 'VENTE_EN_INSTANCE',
        notes: null
      }
    });
  } else {
    console.log(`Devis ${devisNum} not found or already converted.`);
  }

  // 3. Verify Final Counts and CA
  const fichesCount = await prisma.fiche.count();
  const facturesCount = await prisma.facture.count();

  console.log('---------------------------------');
  console.log(`Total Fiches in DB: ${fichesCount} (Expected: 4477)`);
  console.log(`Total Factures in DB: ${facturesCount} (Expected: 4477)`);

  // CA calculation
  const facturesRaw = await prisma.facture.findMany({
    where: {
      statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
      type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR'] },
    },
  });

  const facturesWithFicheIds = new Set(
    facturesRaw
      .filter((f) => f.type === 'FACTURE' && f.ficheId)
      .map((f) => f.ficheId),
  );

  const filteredSales = facturesRaw.filter((f) => {
    const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM';
    const isFacturedViaFiche =
      isBC && f.ficheId && facturesWithFicheIds.has(f.ficheId);
    const isFacturedViaNote = isBC && f.notes?.includes('Remplacée par') || f.notes?.includes('Remplac?e par');
    return !(isFacturedViaFiche || isFacturedViaNote);
  });

  let totalRevenueTTC = 0;
  filteredSales.forEach((f) => {
    const multiplier = f.type === 'AVOIR' ? -1 : 1;
    totalRevenueTTC += multiplier * (f.totalTTC || 0);
  });

  console.log(`Calculated CA (Revenue) in DB: ${totalRevenueTTC} (Expected: 3045403.79)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
