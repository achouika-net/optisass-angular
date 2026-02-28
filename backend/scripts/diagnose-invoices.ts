import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public" } }
});

async function main() {
    console.log('--- Diagnosing FactureFournisseur Duplicates ---\n');

    const total = await prisma.factureFournisseur.count();
    console.log(`Total FactureFournisseur: ${total}`);

    // Count distinct invoices by supplier+numero
    const distinctByNum = await prisma.$queryRaw<any[]>`
        SELECT "numeroFacture", "fournisseurId", COUNT(*) as count
        FROM "FactureFournisseur"
        GROUP BY "numeroFacture", "fournisseurId"
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 20
    `;
    console.log(`\nTop duplicates by (fournisseurId, numeroFacture):`);
    distinctByNum.forEach(r => console.log(`  [${r.fournisseurId}] ${r.numeroFacture}: ${r.count} copies`));

    // How many unique invoice numbers exist?
    const uniqueNums = await prisma.$queryRaw<any[]>`
        SELECT COUNT(DISTINCT "numeroFacture") as unique_nums FROM "FactureFournisseur"
    `;
    console.log(`\nUnique invoice numbers: ${uniqueNums[0].unique_nums}`);

    // Sample of invoices where numeroFacture contains _DUPE_
    const dupes = await prisma.factureFournisseur.count({
        where: { numeroFacture: { contains: '_DUPE_' } }
    });
    console.log(`Records with _DUPE_ in name: ${dupes}`);

    // Find how many suppliers created
    const suppliers = await prisma.fournisseur.count();
    const fournisseurInconnu = await prisma.fournisseur.count({ where: { nom: { contains: 'INCONNU' } } });
    console.log(`\nTotal suppliers: ${suppliers}`);
    console.log(`FOURNISSEUR INCONNU count: ${fournisseurInconnu}`);

    // Invoices attributed to FOURNISSEUR INCONNU
    const inconnuF = await prisma.fournisseur.findFirst({ where: { nom: { contains: 'INCONNU' } } });
    if (inconnuF) {
        const inconnuInvoices = await prisma.factureFournisseur.count({ where: { fournisseurId: inconnuF.id } });
        console.log(`Invoices attributed to FOURNISSEUR INCONNU: ${inconnuInvoices}`);
    }

    // Count by statut
    const byStatut = await prisma.$queryRaw<any[]>`
        SELECT "statut", COUNT(*) as count FROM "FactureFournisseur" GROUP BY "statut" ORDER BY count DESC
    `;
    console.log(`\nCount by statut:`);
    byStatut.forEach(r => console.log(`  ${r.statut}: ${r.count}`));

    // Check EcheancePaiement vs FactureFournisseur ratio
    const echeances = await prisma.echeancePaiement.count();
    const invoices = await prisma.factureFournisseur.count();
    console.log(`\nEcheancePaiement: ${echeances}`);
    console.log(`FactureFournisseur: ${invoices}`);
    console.log(`Ratio (should be ~1:1 before payment import): ${(echeances / invoices).toFixed(2)}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
