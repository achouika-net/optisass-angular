import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== SEARCHING IN ECHEANCEPAIEMENT ===');
  const echeances = await prisma.echeancePaiement.findMany({
    where: {
      OR: [
        { montant: { gte: 1400, lte: 1401 } },
        { type: { contains: 'LCN', mode: 'insensitive' } },
        { type: { contains: 'EFFET', mode: 'insensitive' } },
      ]
    },
    include: {
      factureFournisseur: {
        select: {
          numeroFacture: true,
          montantTTC: true
        }
      },
      bonLivraison: {
        select: {
          numeroBL: true,
          montantTTC: true
        }
      }
    }
  });
  console.log(`Count of echeances: ${echeances.length}`);
  console.log(JSON.stringify(echeances, null, 2));

  console.log('=== SEARCHING IN DEPENSE ===');
  const depenses = await prisma.depense.findMany({
    where: {
      OR: [
        { montant: { gte: 1400, lte: 1401 } },
        { modePaiement: { contains: 'LCN', mode: 'insensitive' } },
        { modePaiement: { contains: 'EFFET', mode: 'insensitive' } },
      ]
    }
  });
  console.log(`Count of depenses: ${depenses.length}`);
  console.log(JSON.stringify(depenses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
