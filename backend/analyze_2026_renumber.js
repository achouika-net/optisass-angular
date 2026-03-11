const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startOf2026 = new Date('2026-01-01T00:00:00.000Z');
  const factures = await prisma.facture.findMany({
    where: {
      createdAt: { gte: startOf2026 }
    },
    select: {
      id: true,
      numero: true,
      type: true,
      statut: true,
      createdAt: true,
      ficheId: true,
      proprietes: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Total documents created in 2026: ${factures.length}`);
  
  // Categorize
  const toRenumber = [];
  const importedOrLegacy = [];

  factures.forEach(f => {
    // Determine if it was imported. Usually imported documents have no ficheId, or have specific properties.
    // Also, if numero matches legacy formats like BC-14389 or Fact-1200, it's likely an import that just has a recent creation date (e.g. during a DB reset).
    const isLikelyImported = 
      !f.ficheId || 
      (f.proprietes && f.proprietes.isImported) ||
      !f.numero.includes('2026'); // If it doesn't even have 2026 in it, it might be an imported legacy number

    if (isLikelyImported) {
      importedOrLegacy.push(f);
    } else {
      toRenumber.push(f);
    }
  });

  console.log(`\nLikely imported/legacy (skipping): ${importedOrLegacy.length}`);
  console.log(`To renumber: ${toRenumber.length}`);

  const byType = {
    'BON_COMM': [],
    'FACTURE': [],
    'DEVIS': [],
    'AVOIR': [],
    'BL': [],
    'OTHER': []
  };

  toRenumber.forEach(f => {
    const type = (f.type === 'BON_COMM' || f.type === 'BON_COMMANDE') ? 'BON_COMM' : f.type;
    if (byType[type]) {
      byType[type].push(f);
    } else {
      byType['OTHER'].push(f);
    }
  });

  console.log('\n--- Documents to renumber by type ---');
  for (const [type, items] of Object.entries(byType)) {
    if (items.length > 0) {
      console.log(`============== ${type} (${items.length}) ==============`);
      items.forEach((item, index) => {
        let prefix = 'DOC';
        if (type === 'BON_COMM') prefix = 'BC';
        if (type === 'FACTURE') prefix = 'Fact';
        if (type === 'DEVIS') prefix = 'DEV';
        
        const expectedSeq = (index + 1).toString().padStart(3, '0');
        const expectedNum = `${prefix}-2026-${expectedSeq}`;
        console.log(`[${item.createdAt.toISOString()}] ${item.type.padEnd(12)} : ${item.numero.padEnd(15)} => proposed: ${expectedNum}`);
      });
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
