
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testQuery() {
    console.log('--- STARTING QUERY PERFORMANCE TEST ---');
    const startTime = Date.now();

    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36'; // From user log

    const depenseWhere = `WHERE d."centreId" = $1 `;
    const echeanceWhere = `WHERE ff."centreId" = $1 `;
    const sqlParams = [centreId];
    const limit = 50;
    const skip = 0;

    const baseQuery = `
      SELECT 
        d.id, d.date, COALESCE(d.description, d.categorie) as libelle, d.categorie as type, 
        COALESCE(f.nom, ff_d.nom, 'N/A') as fournisseur, d.montant, d.statut, 'DEPENSE' as source, 
        d."modePaiement", d.reference, ep_d.banque, d."dateEcheance", ep_d."dateEncaissement", 
        d.montant as "montantHT", NULL as "echeanceId"
      FROM "Depense" d
      LEFT JOIN "Fournisseur" f ON d."fournisseurId" = f.id
      LEFT JOIN "FactureFournisseur" inv_d ON d."factureFournisseurId" = inv_d.id
      LEFT JOIN "Fournisseur" ff_d ON inv_d."fournisseurId" = ff_d.id
      LEFT JOIN "EcheancePaiement" ep_d ON d."echeanceId" = ep_d.id
      ${depenseWhere}
      UNION ALL
      SELECT 
        ff.id, ep."dateEcheance" as date, ff."numeroFacture" || ' (' || ep.type || ')' as libelle, 
        ff.type as type, f_ff.nom as fournisseur, ep.montant, ep.statut, 'FACTURE' as source, 
        ep.type as "modePaiement", COALESCE(ep.reference, ff."numeroFacture") as reference, 
        ep.banque, ep."dateEcheance", ep."dateEncaissement", ff."montantHT", ep.id as "echeanceId"
      FROM "EcheancePaiement" ep
      INNER JOIN "FactureFournisseur" ff ON ep."factureFournisseurId" = ff.id
      INNER JOIN "Fournisseur" f_ff ON ff."fournisseurId" = f_ff.id
      ${echeanceWhere}
      AND NOT EXISTS (SELECT 1 FROM "Depense" d_idx WHERE d_idx."echeanceId" = ep.id)
    `;

    try {
        console.log('Executing Stats Query...');
        const statsQuery = `SELECT COUNT(*)::int as total, COALESCE(SUM(montant), 0)::float as "totalTTC" FROM (${baseQuery}) as c`;
        const stats = await prisma.$queryRawUnsafe(statsQuery, ...sqlParams);
        console.log('Stats:', stats);
        console.log(`Stats Query took ${Date.now() - startTime}ms`);

        const dataStartTime = Date.now();
        console.log('Executing Data Query...');
        const dataQuery = `${baseQuery} ORDER BY date DESC LIMIT ${limit} OFFSET ${skip}`;
        const results = await prisma.$queryRawUnsafe(dataQuery, ...sqlParams);
        console.log(`Results count: ${(results as any).length}`);
        console.log(`Data Query took ${Date.now() - dataStartTime}ms`);

        console.log('Total time:', Date.now() - startTime, 'ms');
    } catch (error) {
        console.error('Error during test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testQuery();
