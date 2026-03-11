const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startOf2026 = new Date('2026-01-01T00:00:00.000Z');
  const factures = await prisma.facture.findMany({
    where: {
      createdAt: { gte: startOf2026 },
      // Exclude obvious big legacy numbers or specifically target the recent 001-005 sequence and 10000
      numero: { in: ['BC-2026-001', 'BC-2026-002', 'BC-2026-003', 'BC-2026-004', 'BC-2026-10000', 'BC-2026'] }
    },
    select: {
      id: true,
      numero: true,
      type: true,
      statut: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Documents to fix:`);
  console.log(JSON.stringify(factures, null, 2));

  // Also check if there are any other small numbers created after March 6
  const recent = await prisma.facture.findMany({
    where: {
      createdAt: { gte: new Date('2026-03-06T00:00:00.000Z') }
    },
    select: { id: true, numero: true, type: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`\nAll documents created since March 6:`);
  recent.forEach(f => console.log(`${f.createdAt.toISOString()} | ${f.type.padEnd(12)} | ${f.numero}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
