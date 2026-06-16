import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const devis = await prisma.facture.findMany({
    where: { type: 'DEVIS' },
    include: {
      fiche: {
        include: {
          client: true
        }
      }
    }
  });

  console.log('=== DEVIS IN DB ===');
  console.log(JSON.stringify(devis, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
