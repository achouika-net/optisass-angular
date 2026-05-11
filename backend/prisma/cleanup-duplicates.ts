import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 [CLEANUP] Starting stock movement cleanup for today (2026-05-10)...');

  const today = new Date('2026-05-10');
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find all SORTIE_VENTE movements for today
  const movements = await prisma.mouvementStock.findMany({
    where: {
      type: 'SORTIE_VENTE',
      dateMovement: {
        gte: today,
        lt: tomorrow,
      },
    },
    orderBy: { dateMovement: 'asc' },
  });

  console.log(`🔍 Found ${movements.length} movements for today.`);

  const seen = new Set<string>();
  const toDelete: string[] = [];
  const toRestore: { id: string; qty: number; pId: string | null }[] = [];

  for (const m of movements) {
    // Unique key: Folder number + Product + Treatment + Index
    const ficheMatch = m.motif.match(/Fiche (?:n° )?(\d+)/);
    const ficheNum = ficheMatch ? ficheMatch[1] : 'Unknown';
    
    // If we have a folder number, we can group by it
    const key = `${ficheNum}-${m.produitId || 'NoProd'}-${m.glassIndexId || 'NoIdx'}-${m.glassTreatmentId || 'NoTreat'}`;

    if (seen.has(key)) {
      console.log(`🚨 Duplicate detected: ${m.motif} (ID: ${m.id})`);
      toDelete.push(m.id);
      toRestore.push({ id: m.id, qty: m.quantite, pId: m.produitId });
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length === 0) {
    console.log('✅ No duplicates found to delete.');
    return;
  }

  console.log(`🗑️ Deleting ${toDelete.length} duplicate entries...`);

  // Restore stock before deleting movement (qty is negative for SORTIE)
  for (const r of toRestore) {
    if (r.pId) {
      console.log(`📈 Restoring stock (+${Math.abs(r.qty)}) for product ${r.pId}`);
      await prisma.product.update({
        where: { id: r.pId },
        data: { quantiteActuelle: { increment: Math.abs(r.qty) } },
      });
    }
    // Note: Add similar restoration for GlassIndex/GlassTreatment if needed
  }

  const result = await prisma.mouvementStock.deleteMany({
    where: {
      id: { in: toDelete },
    },
  });

  console.log(`✨ Cleanup complete. ${result.count} movements removed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
