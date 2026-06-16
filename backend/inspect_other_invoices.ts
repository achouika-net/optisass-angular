import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const others = await prisma.facture.findMany({
    where: {
      NOT: [
        { numero: { startsWith: 'Fact-' } },
        { numero: { startsWith: 'BC-' } },
        { numero: { startsWith: 'DEV-' } },
      ]
    },
    select: {
      id: true,
      numero: true,
      type: true,
      totalTTC: true,
      createdAt: true,
    }
  });

  console.log('=== Other Invoices ===');
  console.log(JSON.stringify(others, null, 2));
}

main().catch(console.error).finally(() => prisma['']());
