import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== SEARCHING FOR 1400.2 EVERYWHERE IN DB ===');
  
  // 1. Fiche
  const fiches = await prisma.fiche.findMany({
    where: {
      OR: [
        { montantTotal: 1400.2 },
        { montantPaye: 1400.2 },
      ]
    }
  });
  console.log(`Fiches:`, fiches);

  // 2. Facture
  const factures = await prisma.facture.findMany({
    where: {
      OR: [
        { totalTTC: 1400.2 },
        { resteAPayer: 1400.2 },
      ]
    }
  });
  console.log(`Factures:`, factures);

  // 3. Paiement
  const paiements = await prisma.paiement.findMany({
    where: {
      OR: [
        { montant: 1400.2 }
      ]
    }
  });
  console.log(`Paiements:`, paiements);

  // 4. TransactionBancaire
  const tx = await prisma.transactionBancaire.findMany({
    where: {
      OR: [
        { montant: 1400.2 }
      ]
    }
  });
  console.log(`TransactionBancaire:`, tx);

  // 5. Depense
  const depenses = await prisma.depense.findMany({
    where: {
      OR: [
        { montant: 1400.2 }
      ]
    }
  });
  console.log(`Depense:`, depenses);

  // 6. FactureFournisseur
  const ff = await prisma.factureFournisseur.findMany({
    where: {
      OR: [
        { montantTTC: 1400.2 }
      ]
    }
  });
  console.log(`FactureFournisseur:`, ff);
}

main().catch(console.error).finally(() => prisma.$disconnect());
