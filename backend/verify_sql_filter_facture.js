const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const query = `
    SELECT 
      ff."numeroFacture", ep.statut, ep.reference 
    FROM "EcheancePaiement" ep
    INNER JOIN "FactureFournisseur" ff ON ep."factureFournisseurId" = ff.id
    WHERE ff."numeroFacture" = '768987'
    AND (
         ep.statut IN ('ENCAISSE', 'ENCAISSÉ', 'ENCAISSÉE', 'PAYEE', 'PAYÉ', 'PAYÉE', 'VALIDE', 'VALIDÉ', 'VALIDÉE', 'SOLDE', 'SOLDÉ', 'SOLDÉE', 'DÉCAISSÉ', 'DECAISSE') 
         OR (ep.reference IS NOT NULL AND ep.reference <> '' AND ep.reference <> ' ')
    )
  `;

  console.log('Running test query (Facture part)...');
  const res = await prisma.$queryRawUnsafe(query);
  console.log('Result:', res);
}

main().catch(console.error).finally(() => prisma.$disconnect());
