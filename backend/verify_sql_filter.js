const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const query = `
    SELECT 
      bl."numeroBL", ep.statut, ep.reference 
    FROM "EcheancePaiement" ep
    INNER JOIN "BonLivraison" bl ON ep."bonLivraisonId" = bl.id
    WHERE bl."numeroBL" = '768987'
    AND (
         ep.statut IN ('ENCAISSE', 'ENCAISSÉ', 'ENCAISSÉE', 'PAYEE', 'PAYÉ', 'PAYÉE', 'VALIDE', 'VALIDÉ', 'VALIDÉE', 'SOLDE', 'SOLDÉ', 'SOLDÉE', 'DÉCAISSÉ', 'DECAISSE') 
         OR (ep.reference IS NOT NULL AND TRIM(ep.reference) <> '')
    )
  `;

  console.log('Running test query...');
  const res = await prisma.$queryRawUnsafe(query);
  console.log('Result:', res);
}

main().catch(console.error).finally(() => prisma.$disconnect());
