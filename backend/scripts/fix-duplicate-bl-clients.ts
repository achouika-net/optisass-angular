import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all BonLivraison records...');
  const allBLs = await prisma.bonLivraison.findMany({
    select: {
      id: true,
      numeroBL: true,
      fournisseurId: true,
      clientId: true,
      ficheId: true,
    }
  });

  console.log(`Fetched ${allBLs.length} records. Processing...`);

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

  let updatedCount = 0;

  for (const [key, group] of groups.entries()) {
    if (group.length <= 1) continue;

    // Find the best clientId and ficheId in the group
    const bestClientId = group.find(b => b.clientId)?.clientId || null;
    const bestFicheId = group.find(b => b.ficheId)?.ficheId || null;

    if (!bestClientId && !bestFicheId) continue;

    // For all records in the group, update if missing
    for (const bl of group) {
      const needsClient = bestClientId && !bl.clientId;
      const needsFiche = bestFicheId && !bl.ficheId;

      if (needsClient || needsFiche) {
        await prisma.bonLivraison.update({
          where: { id: bl.id },
          data: {
            clientId: bl.clientId || bestClientId,
            ficheId: bl.ficheId || bestFicheId,
          }
        });
        updatedCount++;
      }
    }
  }

  console.log(`Migration completed. Updated ${updatedCount} BonLivraison records.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
