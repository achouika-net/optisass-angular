import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const centers = await prisma.centre.findMany();
  console.log('=== Centers in DB ===');
  console.log(JSON.stringify(centers, null, 2));

  // Let's also count invoices and total amount per center
  for (const c of centers) {
    const facturesRaw = await prisma.facture.findMany({
      where: {
        centreId: c.id,
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

    console.log(`Center "${c.nom}" (ID: ${c.id}): Invoices count = ${filteredSales.length}, CA = ${totalRevenueTTC}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
