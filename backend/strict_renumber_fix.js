const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allCurrent = await prisma.facture.findMany({
    select: { id: true, numero: true, type: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  const regex = /^(BC|Fact|DEV)-2026-\d+$/;
  const isAppGenerated = (num) => regex.test(num) || num === 'BC-2026' || num.startsWith('TEMP-RENUMBER-');

  const toRenumber = allCurrent.filter(f => isAppGenerated(f.numero));
  
  if (toRenumber.length === 0) {
    console.log("No matching documents found!");
    return;
  }

  console.log(`Phase 1: Temporary Rename for ${toRenumber.length} documents.`);
  const tempUpdates = toRenumber.map(f => {
    return prisma.facture.update({
      where: { id: f.id },
      data: { numero: `TEMP-RENUMBER-${f.id.split('-')[0]}` }
    });
  });
  await prisma.$transaction(tempUpdates);
  
  console.log('Phase 2: Final Sequential Allocation.');
  let counters = { BC: 1, Fact: 1, DEV: 1 };
  const getPrefix = (type) => {
    if (['BON_COMM', 'BON_COMMANDE'].includes(type)) return 'BC';
    if (type === 'FACTURE') return 'Fact';
    if (type === 'DEVIS') return 'DEV';
    return null;
  };

  const finalUpdates = [];

  // Need to fetch fresh data since we updated them
  const refreshed = await prisma.facture.findMany({
    where: { numero: { startsWith: 'TEMP-RENUMBER-' } },
    orderBy: { createdAt: 'asc' }
  });

  refreshed.forEach(f => {
    const key = getPrefix(f.type);
    if (!key) return; // ignore AVOIR etc. if any

    const newNum = `${key}-2026-${counters[key].toString().padStart(3, '0')}`;
    counters[key]++;
    
    console.log(`Mapping ${f.createdAt.toISOString()} | ${f.type.padEnd(12)} -> ${newNum}`);
    
    finalUpdates.push(prisma.facture.update({
      where: { id: f.id },
      data: { numero: newNum }
    }));
  });

  await prisma.$transaction(finalUpdates);
  console.log(`Successfully completed 2-phase renumbering for ${finalUpdates.length} documents.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
