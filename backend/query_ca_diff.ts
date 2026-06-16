import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const recent = await prisma.facture.findMany({
    where: {
      createdAt: { gte: new Date('2026-06-14T00:00:00Z') }
    },
    select: {
      numero: true,
      type: true,
      totalTTC: true,
      createdAt: true,
    }
  });

  console.log('Recent factures in DB: ' + recent.length);
  console.log(JSON.stringify(recent, null, 2));
}

main().catch(console.error).finally(() => prisma['']());
