import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  // Summary stats
  const totalTx = await prisma.transactionBancaire.count();
  const rapprocheTx = await prisma.transactionBancaire.count({ where: { statutRapprochement: "RAPPROCHE" } });
  const nonRapproche = await prisma.transactionBancaire.count({ where: { statutRapprochement: "NON_RAPPROCHE" } });
  
  console.log(`Transactions: Total=${totalTx}, Reconciled=${rapprocheTx}, Pending=${nonRapproche}`);
  
  // Check that paiements are accessible
  const pendingPaiements = await prisma.paiement.findMany({
    where: {
      OR: [
        { statut: "REMIS_EN_BANQUE" },
        { statut: "EN_ATTENTE" },
        { statut: "ENCAISSE", mode: { in: ["CARTE", "CARTE BANCAIRE", "CB", "TPE"] }, transactionBancaireId: null }
      ]
    }
  });
  console.log(`Pending paiements: ${pendingPaiements.length}`);
  pendingPaiements.forEach(p => console.log(" -", p.mode, p.montant, p.statut));
  
  // Check depenses pending
  const pendingDeps = await prisma.depense.findMany({
    where: {
      statut: { in: ["REMIS_EN_BANQUE", "EN_ATTENTE", "VALIDEE", "A_PAYER"] },
      transactionBancaireId: null,
      modePaiement: { notIn: ["ESPECES", "Liquide", "LIQUIDE", "CASH", "Especes", "Prelevement", "PRELEVEMENT", "Caisse", "CAISSE"] }
    }
  });
  console.log(`Pending depenses: ${pendingDeps.length}`);
  pendingDeps.forEach(d => console.log(" -", d.montant, d.statut, d.modePaiement, d.description?.slice(0,30)));
}
main().catch(console.error).finally(() => prisma["$disconnect"]());
