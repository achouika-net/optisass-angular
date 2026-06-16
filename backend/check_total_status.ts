import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const fichesCount = await prisma.fiche.count();
  const facturesCount = await prisma.facture.count();

  console.log(`Total Fiches in DB: ${fichesCount}`);
  console.log(`Total Factures in DB: ${facturesCount}`);

  // Compute CA (Revenue) using getFilteredSales logic
  // which filters out ARCHIVE, ANNULEE status, and types FACTURE, BON_COMMANDE, BON_COMM, AVOIR.
  // And it de-duplicates BCs if they are invoiced via a Fiche.
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

  console.log(`Calculated CA (Revenue) in DB: ${totalRevenueTTC}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
