import { PrismaClient } from '@prisma/client';

async function testTreasury() {
  const prisma = new PrismaClient();
  try {
    const year = 2026;
    const month = 5;
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';
    const startDate = '2026-04-30T23:00:00.000Z';
    const endDate = '2026-05-31T22:59:59.999Z';

    console.log('Testing getMonthlySummary with:', { year, month, centreId, startDate, endDate });

    // Mock the logic to see where it fails
    const PAID_STATUSES = [
      'ENCAISSE', 'ENCAISSÉ', 'ENCAISSÉE', 'PAYE', 'PAYÉ', 'PAYEE', 'PAYÉE', 'VALIDE', 'VALIDÉ', 'VALIDÉE',
      'SOLDE', 'SOLDÉ', 'SOLDÉE', 'DECAISSE', 'DÉCAISSÉ', 'DECAISSEMENT'
    ];
    const paidStatusesSQL = PAID_STATUSES.map((s) => `'${s}'`).join(', ');

    // Test OutEmission
    const emissionQuery = `
      SELECT 
        d.id, d.date as date, COALESCE(d.description, d.categorie) as libelle, d.categorie as type, 
        COALESCE(f.nom, ff_d.nom, 'N/A') as fournisseur, d.montant, 'ENCAISSE' as statut, 'DEPENSE' as source, 
        d."modePaiement" as "methodePaiement", d.reference as "numeroPiece", 
        COALESCE(ep_d.banque, 'CAISSE') as banque, COALESCE(d."dateEcheance", d.date) as "dateEcheance", 
        d.date as "dateEncaissement", d.montant as "montantHT", ep_d.id as "echeanceId"
      FROM "Depense" d
      LEFT JOIN "Fournisseur" f ON d."fournisseurId" = f.id
      LEFT JOIN "FactureFournisseur" inv_d ON d."factureFournisseurId" = inv_d.id
      LEFT JOIN "Fournisseur" ff_d ON inv_d."fournisseurId" = ff_d.id
      LEFT JOIN "EcheancePaiement" ep_d ON d."echeanceId" = ep_d.id
      WHERE 1=1 AND d."centreId" = $1 AND d.date >= $2 AND d.date <= $3
      UNION ALL
      SELECT 
        ep.id, COALESCE(ff."dateEmission", ep."dateEcheance") as date, 
        CASE WHEN ff.id IS NOT NULL THEN '[F] ' || ff."numeroFacture" ELSE '[Paiement direct] ' || COALESCE(ep.reference, '') END as libelle,
        COALESCE(ff.type, 'ACHAT_STOCK') as type, 
        COALESCE(f_ff.nom, 'N/A') as fournisseur, ep.montant, ep.statut, 'FACTURE' as source, 
        ep.type as "methodePaiement", ep.reference as "numeroPiece", 
        COALESCE(ep.banque, 'BANQUE') as banque, ep."dateEcheance", ep."dateEncaissement", 
        CASE WHEN ff.id IS NOT NULL AND ff."montantTTC" > 0 THEN (ep.montant * (ff."montantHT" / ff."montantTTC")) ELSE ep.montant END as "montantHT", 
        ep.id as "echeanceId"
      FROM "EcheancePaiement" ep
      LEFT JOIN "FactureFournisseur" ff ON ep."factureFournisseurId" = ff.id
      LEFT JOIN "Fournisseur" f_ff ON COALESCE(ff."fournisseurId", (SELECT "fournisseurId" FROM "BonLivraison" WHERE id = ep."bonLivraisonId")) = f_ff.id
      WHERE 1=1 
      AND COALESCE(ff."centreId", (SELECT "centreId" FROM "BonLivraison" WHERE id = ep."bonLivraisonId"), (SELECT "centreId" FROM "Depense" WHERE "echeanceId" = ep.id)) = $1 
      AND COALESCE(ff."dateEmission", ep."dateEcheance") >= $2 AND COALESCE(ff."dateEmission", ep."dateEcheance") <= $3
      AND ep.id NOT IN (SELECT "echeanceId" FROM "Depense" WHERE "echeanceId" IS NOT NULL)
      AND (ep.statut IN (${paidStatusesSQL}) OR (ep.reference IS NOT NULL AND ep.reference <> '') OR (ep.montant > 0 AND ep."dateEcheance" IS NOT NULL))
    `;

    console.log('Running emissionStats query...');
    const params = [centreId, new Date(startDate), new Date(endDate)];
    const emissionStats = await prisma.$queryRawUnsafe(`SELECT montant as total, type, source as cat FROM (${emissionQuery}) as c`, ...params);
    console.log('emissionStats success, rows:', (emissionStats as any[]).length);

    // Test InEcheance
    const incomingQuery = `
      SELECT 
        p.id, p.date, p.montant, p.statut, p.mode, f."dateEmission" as "factureDate",
        COALESCE(f.numero, 'N/A') as libelle,
        COALESCE(c.nom, '') || ' ' || COALESCE(c.prenom, '') as client,
        p.reference as "numeroPiece", p.banque
      FROM "Paiement" p
      LEFT JOIN "Facture" f ON p."factureId" = f.id
      LEFT JOIN "Client" c ON f."clientId" = c.id
      WHERE 1=1 AND p."centreId" = $1 AND p.date >= $2 AND p.date <= $3
    `;
    console.log('Running incomingStats query...');
    const incomingStats = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(montant), 0)::float as total, COALESCE(SUM(CASE WHEN statut IN (${paidStatusesSQL}) THEN montant ELSE 0 END), 0)::float as paid, COALESCE(SUM(CASE WHEN statut IN ('EN_ATTENTE', 'PORTEFEUILLE', 'REMIS_EN_BANQUE', 'DEPOSE') THEN montant ELSE 0 END), 0)::float as pending, COALESCE(SUM(CASE WHEN mode IN ('ESPECES', 'LIQUIDE', 'CASH', 'ESPÈCES', 'ESPÈCE', 'ESPECE') AND statut IN (${paidStatusesSQL}) THEN montant ELSE 0 END), 0)::float as cash, COALESCE(SUM(CASE WHEN mode IN ('CARTE', 'CARTE BANCAIRE', 'CB', 'TPE') AND statut IN (${paidStatusesSQL}) THEN montant ELSE 0 END), 0)::float as card, COALESCE(SUM(CASE WHEN mode IN ('PRISE_EN_CHARGE', 'PRISE EN CHARGE', 'PEC') THEN montant ELSE 0 END), 0)::float as pec, COUNT(CASE WHEN mode IN ('PRISE_EN_CHARGE', 'PRISE EN CHARGE', 'PEC') THEN 1 END)::int as pec_count FROM (${incomingQuery}) as c`, ...params);
    console.log('incomingStats success:', incomingStats);

  } catch (err) {
    console.error('TEST FAILED:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testTreasury();
