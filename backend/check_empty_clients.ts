import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const clientsWithNoFiche = await prisma.client.findMany({
    where: {
      fiches: {
        none: {}
      }
    },
    include: {
      factures: true,
      bonsLivraison: true,
      facturesFournisseurs: true,
      virtualTryons: true,
      filleuls: true,
      pointsHistory: true,
      rewardRedemptions: true,
    }
  });

  console.log(`Total clients with no Fiche: ${clientsWithNoFiche.length}`);
  
  let withFacture = 0;
  let withBL = 0;
  let withFF = 0;
  let withTryon = 0;
  let withFilleuls = 0;
  let withPoints = 0;
  let withRewards = 0;
  let cleanToDelete = 0;

  for (const c of clientsWithNoFiche) {
    let clean = true;
    if (c.factures.length > 0) { withFacture++; clean = false; }
    if (c.bonsLivraison.length > 0) { withBL++; clean = false; }
    if (c.facturesFournisseurs.length > 0) { withFF++; clean = false; }
    if (c.virtualTryons.length > 0) { withTryon++; clean = false; }
    if (c.filleuls.length > 0) { withFilleuls++; clean = false; }
    if (c.pointsHistory.length > 0) { withPoints++; clean = false; }
    if (c.rewardRedemptions.length > 0) { withRewards++; clean = false; }
    
    if (clean) cleanToDelete++;
  }

  console.log(`- With Factures: ${withFacture}`);
  console.log(`- With Bons de Livraison: ${withBL}`);
  console.log(`- With Factures Fournisseurs: ${withFF}`);
  console.log(`- With Virtual Tryons: ${withTryon}`);
  console.log(`- With Filleuls (referrals): ${withFilleuls}`);
  console.log(`- With Points History: ${withPoints}`);
  console.log(`- With Reward Redemptions: ${withRewards}`);
  console.log(`- Clean to delete (no other relations): ${cleanToDelete}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
