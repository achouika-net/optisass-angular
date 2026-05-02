import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Searching for FactureFournisseur around 2260 DH in May 2026 ---');
  
  const factures = await prisma.factureFournisseur.findMany({
    where: { 
      montantTTC: { gte: 2250, lte: 2270 },
      dateEcheance: {
        gte: new Date('2026-05-01T00:00:00Z'),
        lte: new Date('2026-05-31T23:59:59Z')
      }
    },
    include: { fournisseur: true }
  });
  
  console.log('\n--- FACTURES MAY 2026 ---');
  factures.forEach(f => {
    console.log(`ID: ${f.id}, Num: ${f.numeroFacture}, DateEch: ${f.dateEcheance}, TTC: ${f.montantTTC}, Statut: ${f.statut}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
