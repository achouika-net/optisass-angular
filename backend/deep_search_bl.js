const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const blNum = '768987';
  console.log(`Searching for ${blNum} in database...`);

  const bls = await prisma.bonLivraison.findMany({
    where: { numeroBL: blNum },
    include: { echeances: true }
  });
  console.log('BonLivraison:', JSON.stringify(bls, null, 2));

  const ffs = await prisma.factureFournisseur.findMany({
    where: { numeroFacture: blNum },
    include: { echeances: true }
  });
  console.log('FactureFournisseur:', JSON.stringify(ffs, null, 2));

  const depenses = await prisma.depense.findMany({
    where: { 
      OR: [
        { description: { contains: blNum } },
        { reference: { contains: blNum } }
      ]
    }
  });
  console.log('Depenses:', JSON.stringify(depenses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
