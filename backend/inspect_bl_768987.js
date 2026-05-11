const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bl = await prisma.bonLivraison.findFirst({
    where: { numeroBL: '768987' },
    include: {
      echeances: true
    }
  });

  if (!bl) {
    console.log('BL 768987 not found');
    return;
  }

  console.log('BL Found:', bl.id, bl.numeroBL, bl.montantTTC);
  console.log('Echeances:', JSON.stringify(bl.echeances, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
