import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find all ENCAISSE echeances that are linked to a bank transaction via transaction status
  // or matched to a TransactionBancaire
  // Wait, EcheancePaiement doesn't store transactionBancaireId directly in the schema.
  // Instead, the transactionBancaireId is stored on the Depense record!
  // If an Echeance is ENCAISSE, but has no linked Depense, we must search for the TransactionBancaire
  // that was matched. Let's find TransactionBancaire records that are RAPPROCHE but have no depense linked
  // OR we can find echeances with status ENCAISSE and no linked depense.
  const echeances = await prisma.echeancePaiement.findMany({
    where: {
      statut: 'ENCAISSE',
      depense: null
    },
    include: {
      factureFournisseur: true,
      bonLivraison: true
    }
  });

  console.log(`Found ${echeances.length} ENCAISSE echeances without linked Depense.`);

  for (const e of echeances) {
    // Find the corresponding TransactionBancaire that has the same amount and reference in description
    const tx = await prisma.transactionBancaire.findFirst({
      where: {
        montant: e.montant,
        type: 'DEBIT',
        description: { contains: e.reference || '', mode: 'insensitive' }
      },
      include: { releveBancaire: { include: { compteBancaire: true } } }
    });

    if (tx) {
      console.log(`Matching Echeance ${e.reference} (${e.montant} MAD) to Transaction: "${tx.description}" (${tx.id})`);
      
      let centreId = e.factureFournisseur?.centreId || e.bonLivraison?.centreId;
      if (!centreId) {
        centreId = tx.releveBancaire?.compteBancaire?.centreId || (await prisma.centre.findFirst())?.id || '';
      }

      await prisma.depense.create({
        data: {
          date: tx.dateTransaction,
          montant: e.montant,
          categorie: e.factureFournisseurId ? 'Facture Fournisseur' : 'Bon de Livraison',
          description: `${e.type} N° ${e.reference || ''}`.trim(),
          modePaiement: e.type,
          statut: 'PAYE',
          centreId: centreId,
          echeanceId: e.id,
          transactionBancaireId: tx.id,
          factureFournisseurId: e.factureFournisseurId,
          fournisseurId: e.factureFournisseur?.fournisseurId || e.bonLivraison?.fournisseurId || null
        }
      });
      console.log('Created Depense successfully.');
    } else {
      console.log(`Could not find matching transaction for Echeance ${e.reference} (${e.montant} MAD)`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
