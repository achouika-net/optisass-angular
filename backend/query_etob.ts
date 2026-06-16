import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const invoice = await prisma.factureFournisseur.findFirst({
    where: { numeroFacture: '454564' },
    include: {
      echeances: true,
      fournisseur: true
    }
  });
  console.log('Invoice:', JSON.stringify(invoice, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
