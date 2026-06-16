const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function getFilteredSales(start, end, centreFilter) {
  const facturesRaw = await prisma.facture.findMany({
    where: {
      dateEmission: { gte: start, lte: end },
      statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
      type: { in: ['FACTURE', 'BON_COMMANDE', 'BON_COMM', 'AVOIR'] },
      ...centreFilter,
    }
  });
  const facturesWithFicheIds = new Set(
    facturesRaw
      .filter((f) => f.type === 'FACTURE' && f.ficheId)
      .map((f) => f.ficheId)
  );
  return facturesRaw.filter((f) => {
    const isBC = f.type === 'BON_COMMANDE' || f.type === 'BON_COMM';
    const isFacturedViaFiche =
      isBC && f.ficheId && facturesWithFicheIds.has(f.ficheId);
    const isFacturedViaNote = isBC && f.notes?.includes('Remplac');
    return !(isFacturedViaFiche || isFacturedViaNote);
  });
}
async function main() {
  const start = new Date('2025-12-31T23:00:00.000Z');
  const end = new Date('2026-05-31T22:59:59.999Z');
  const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';
  const sales = await getFilteredSales(start, end, { centreId });
  console.log('Sales count for date:', sales.length);
  console.log('totalRevenueTTC:', sales.reduce((sum, f) => sum + (f.totalTTC || 0), 0));
}
main().catch(console.error).finally(() => prisma.$disconnect());
