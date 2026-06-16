import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const nums = [12364, 12525, 12621, 12065, 12470];
  const fiches = await prisma.fiche.findMany({
    where: { numero: { in: nums } },
    include: {
      facture: {
        include: {
          paiements: true,
          mouvementsStock: true
        }
      },
      bonsLivraison: true
    }
  });

  console.log('=== Phantom Fiches and Dependencies ===');
  for (const f of fiches) {
    console.log(`Fiche ${f.numero}:`);
    console.log(`  - Fiche ID: ${f.id}`);
    console.log(`  - Facture ID: ${f.facture?.id}`);
    console.log(`  - Facture Numero: ${f.facture?.numero}`);
    console.log(`  - Payments count: ${f.facture?.paiements.length || 0}`);
    if (f.facture?.paiements.length) {
      console.log(`    Payments:`, JSON.stringify(f.facture.paiements, null, 2));
    }
    console.log(`  - Stock movements count: ${f.facture?.mouvementsStock.length || 0}`);
    console.log(`  - BL count: ${f.bonsLivraison.length || 0}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
