const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const recentInvoices = await prisma.facture.findMany({
    where: {
      createdAt: { gte: new Date('2026-03-05T00:00:00.000Z') },
      numero: { notIn: ['BC-12026', 'Fact-2/2026', 'BC-2026'] }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Phase 1: Renaming ${recentInvoices.length} documents to temporary names to avoid collisions.`);
  
  const tempUpdates = recentInvoices.map(f => {
    return prisma.facture.update({
      where: { id: f.id },
      data: { numero: `TEMP-RENUMBER-${f.id.split('-')[0]}` }
    });
  });

  await prisma.$transaction(tempUpdates);
  console.log('Phase 1 completed. All target numbers are now free.');

  console.log('Phase 2: Applying correct sequential numbers.');

  let counters = { BC: 1, Fact: 1, DEV: 1, AVR: 1 };
  const finalUpdates = [];

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
      
      console.log(`Mapping ${f.id.split('-')[0]}... (${f.type}) => ${newNum}`);
      
      finalUpdates.push(prisma.facture.update({
        where: { id: f.id },
        data: { numero: newNum }
      }));
    }
  });

  await prisma.$transaction(finalUpdates);
  console.log('Phase 2 completed. All documents successfully renumbered.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
