import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const start = new Date(0);
  const end = new Date(3000, 0, 1);

  const facturesRaw = await prisma.facture.findMany({
    where: {
      dateEmission: { gte: start, lte: end },
      statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
      type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR'] },
    },
  });

  console.log(`Raw factures count: ${facturesRaw.length}`);

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

  console.log(`Filtered sales count: ${filteredSales.length}`);

  let totalRevenueTTC = 0;
  let totalAvoirs = 0;
  let countAvoirs = 0;
  filteredSales.forEach((f) => {
    if (f.type === 'AVOIR') {
      totalAvoirs += f.totalTTC || 0;
      countAvoirs++;
      totalRevenueTTC -= f.totalTTC || 0;
    } else {
      totalRevenueTTC += f.totalTTC || 0;
    }
  });

  console.log(`Calculated CA (Revenue) with Avoirs subtracted: ${totalRevenueTTC}`);
  console.log(`Avoirs count: ${countAvoirs}, sum: ${totalAvoirs}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
