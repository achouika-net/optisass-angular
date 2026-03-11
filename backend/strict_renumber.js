const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching app-generated 2026 documents...');
  
  // App-generated documents follow the pattern: Prefix-Year-Sequence
  // E.g., BC-2026-001, Fact-2026-something
  const allCurrent = await prisma.facture.findMany({
    select: { id: true, numero: true, type: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  // Filter only those matching the exact new app pattern (e.g., BC-2026-[numbers])
  // We explicitly include BC-2026-10000, BC-2026-001, etc.
  const regex = /^(BC|Fact|DEV)-2026-\d+$/;
  // Also include "BC-2026" base if it exists
  const isAppGenerated = (num) => regex.test(num) || num === 'BC-2026';

  const toRenumber = allCurrent.filter(f => isAppGenerated(f.numero));
  
  console.log(`Found ${toRenumber.length} strictly app-generated 2026 documents.`);
  toRenumber.forEach(f => {
    console.log(`- ${f.createdAt.toISOString()} | ${f.type.padEnd(12)} | ${f.numero}`);
  });

  let counters = { BC: 1, Fact: 1, DEV: 1 };
  const updates = [];

  toRenumber.forEach(f => {
    let prefix = 'DOC';
    let counterKey = null;

    if (f.type === 'BON_COMM' || f.type === 'BON_COMMANDE') {
      prefix = 'BC';
      counterKey = 'BC';
    } else if (f.type === 'FACTURE') {
      prefix = 'Fact';
      counterKey = 'Fact';
    } else if (f.type === 'DEVIS') {
      prefix = 'DEV';
      counterKey = 'DEV';
    }

    if (counterKey) {
      const newNum = `${prefix}-2026-${counters[counterKey].toString().padStart(3, '0')}`;
      counters[counterKey]++;
      
      if (f.numero !== newNum) {
        console.log(`Updating: ${f.numero} -> ${newNum} (${f.type})`);
        updates.push(prisma.facture.update({
          where: { id: f.id },
          data: { numero: newNum }
        }));
      } else {
        console.log(`Keeping: ${f.numero} (Correct type & sequence)`);
      }
    }
  });

  if (updates.length > 0) {
    console.log(`Applying ${updates.length} updates...`);
    await prisma.$transaction(updates);
    console.log('Successfully applied independent sequences.');
  } else {
    console.log('All documents already have the correct sequence. No updates needed.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
