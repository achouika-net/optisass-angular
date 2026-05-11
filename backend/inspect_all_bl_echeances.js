const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const echeances = await prisma.echeancePaiement.findMany({
    where: {
      bonLivraisonId: { not: null },
      factureFournisseurId: null
    },
    include: {
      bonLivraison: true
    }
  });

  console.log(`Total BL Echeances (Not grouped): ${echeances.length}`);
  
  echeances.forEach(e => {
    console.log(`BL: ${e.bonLivraison?.numeroBL} | ID: ${e.id} | Type: ${e.type} | Statut: ${e.statut} | Ref: "${e.reference || ''}" | Montant: ${e.montant}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
