const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // First, we find all documents created since March 5th, 2026.
  // We exclude obvious imported legacy documents (if any exist in this narrow timeframe)
  // based on the fact that these are the manual tests made by the user.
  const recentInvoices = await prisma.facture.findMany({
    where: {
      createdAt: { gte: new Date('2026-03-05T00:00:00.000Z') },
      // Specifically excluding the legacy 'BC-12026' and 'Fact-2/2026' generated rapidly at start
      numero: { notIn: ['BC-12026', 'Fact-2/2026', 'BC-2026'] }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${recentInvoices.length} recent documents to renumber.`);

  let counters = {
    BC: 1,
    Fact: 1,
    DEV: 1,
    AVR: 1
  };

  const updates = [];

  recentInvoices.forEach(f => {
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
    } else if (f.type === 'AVOIR') {
      prefix = 'AVR';
      counterKey = 'AVR';
    }

    if (counterKey) {
      const newNum = `${prefix}-2026-${counters[counterKey].toString().padStart(3, '0')}`;
      counters[counterKey]++;
      
      console.log(`Mapping ${f.id.split('-')[0]}... (${f.type}): ${f.numero} => ${newNum}`);
      
      updates.push(prisma.facture.update({
        where: { id: f.id },
        data: { numero: newNum }
      }));
    }
  });

  if (updates.length > 0) {
    console.log('Applying updates...');
    await prisma.$transaction(updates);
    console.log('Successfully renumbered documents.');
  } else {
    console.log('No updates required.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
