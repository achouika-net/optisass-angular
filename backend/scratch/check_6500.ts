import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
    }
  }
});

async function main() {
  const echeances = await prisma.echeancePaiement.findMany({
    where: { 
      OR: [
        { montant: 6500 },
        { reference: '56798769' }
      ]
    },
    include: {
      depense: true,
      factureFournisseur: true,
      bonLivraison: true
    }
  });

  console.log('--- FOUND ECHEANCES ---');
  console.log(JSON.stringify(echeances, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
