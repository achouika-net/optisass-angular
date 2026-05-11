const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
    }
  }
});

// Import or simulate the logic
async function main() {
  try {
      // Simulation simplifiée du SQL que j'ai écrit
      const paidStatuses = "'ENCAISSE', 'ENCAISSÉ', 'ENCAISSÉE', 'PAYE', 'PAYÉ', 'PAYEE', 'PAYÉE', 'VALIDE', 'VALIDÉ', 'VALIDÉE', 'SOLDE', 'SOLDÉ', 'SOLDÉE', 'DECAISSE', 'DÉCAISSÉ', 'DECAISSEMENT'";
      
      const query = `
        SELECT 
          COALESCE(ff.id, ep.id) as id, 
          COALESCE(ff."dateEmission", ep."dateEcheance") as date, 
          ep.montant, ep.statut
        FROM "EcheancePaiement" ep
        LEFT JOIN "FactureFournisseur" ff ON ep."factureFournisseurId" = ff.id
        WHERE COALESCE(ff."dateEmission", ep."dateEcheance") >= '2026-05-01'
          AND COALESCE(ff."dateEmission", ep."dateEcheance") <= '2026-05-31'
          AND (
             ep.statut IN (${paidStatuses}) 
             OR (ep.reference IS NOT NULL AND ep.reference <> '' AND ep.reference <> ' ')
          )
      `;
      
      const results = await prisma.$queryRawUnsafe(query);
      console.log('Resultats Echéances Mai:', JSON.stringify(results, null, 2));
      
      const total = results.reduce((acc, curr) => acc + Number(curr.montant), 0);
      console.log('Total Echéances Mai:', total);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
