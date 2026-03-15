import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Fiche Type Restoration ---');

  // Find all fiches with type 'DEVIS'
  // We identify them because:
  // 1. Their type is 'DEVIS' (which shouldn't exist as a Fiche type, only as a Facture type)
  // 2. They usually contain 'lentilles' in their content (JSONB)
  const fichesToFix = await prisma.fiche.findMany({
    where: {
      OR: [
        { type: 'DEVIS' },
        { type: 'LENTILLES' },
        { statut: 'DEVIS_EN_COURS' },
        { statut: 'true' }
      ],
    },
  });

  console.log(`Found ${fichesToFix.length} fiches to investigate.`);

  let count = 0;
  for (const fiche of fichesToFix) {
    console.log(`Normalizing Fiche #${fiche.numero} (ID: ${fiche.id})...`);
    
    await prisma.fiche.update({
      where: { id: fiche.id },
      data: {
        type: 'lentilles',
        statut: 'en_cours',
      },
    });
    count++;
  }

  console.log(`--- Restoration Complete. ${count} fiches updated. ---`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
