const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    // The 155 missing factures are likely BCs that are PAYEE and have numeric numbering
    // In the old system, a "FACTURE" was explicitly invoiced (fiscal document with xx/yyyy number)
    // and a "VENTE SANS FACTURE" was a sale without formal invoice.
    // But some BCs were fully paid and should have been promoted to FACTURE.
    // Let's identify them by looking at PAYEE BCs without xx/yyyy numbers.

    const totalBC = await p.facture.count({ where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } });
    const bcPayee = await p.facture.count({ where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: 'PAYEE', NOT: { numero: { contains: '/' } } } });
    const bcValide = await p.facture.count({ where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: 'VALIDE', NOT: { numero: { contains: '/' } } } });
    const bcValidee = await p.facture.count({ where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: 'VALIDEE', NOT: { numero: { contains: '/' } } } });

    console.log(`\nTotal BCs (non archivés): ${totalBC}  (référence 10392 — écart: ${totalBC - 10392})`);
    console.log(`  BC PAYEE (sans /):    ${bcPayee}`);
    console.log(`  BC VALIDE (sans /):   ${bcValide}`);
    console.log(`  BC VALIDEE (sans /):  ${bcValidee}`);

    // Check if some VALIDEE/VALIDE BCs could be the missing FACTUREs
    // The reference bilan says 2843 FACTURES at 5,881,132 DH and 10,392 sales without invoice
    // The 6 extra BCs (10398 - 10392 = +6) are probably new BCs created in Optisaas
    // The 155 missing FACTUREs are ones that were not imported as xx/yyyy docs

    // Let's see BCs created in 2026 (new ones, not part of import)
    const bcNew = await p.facture.findMany({
        where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] }, dateEmission: { gte: new Date('2026-01-01') } },
        select: { numero: true, statut: true, dateEmission: true, totalTTC: true }
    });
    console.log(`\nBCs créés en 2026 (nouveaux, post-import): ${bcNew.length}`);
    bcNew.forEach(b => console.log(`  ${b.numero} | ${b.statut} | ${b.dateEmission.toISOString().substring(0, 10)} | ${b.totalTTC}`));

    // The 155 FACTUREs gap: they were likely in the old system but were NOT in the import Excel
    // OR they were in the import but structured as DEVIS without xx/yyyy numbering
    // Let's look at BCs with a statut that suggests they started as more "official" transactions
    const bcCountByYear = await p.facture.findMany({
        where: { type: { in: ['BON_COMMANDE', 'BON_COMM'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } },
        select: { dateEmission: true }
    });
    const byYear = {};
    for (const b of bcCountByYear) {
        const y = b.dateEmission?.getFullYear() || 'unknown';
        byYear[y] = (byYear[y] || 0) + 1;
    }
    console.log('\nBCs par année:');
    for (const [y, c] of Object.entries(byYear).sort()) {
        console.log(`  ${y}: ${c}`);
    }

    // FACTURES par année
    const facCountByYear = await p.facture.findMany({
        where: { type: 'FACTURE', statut: { notIn: ['ARCHIVE', 'ANNULEE'] } },
        select: { dateEmission: true }
    });
    const byYearF = {};
    for (const f of facCountByYear) {
        const y = f.dateEmission?.getFullYear() || 'unknown';
        byYearF[y] = (byYearF[y] || 0) + 1;
    }
    console.log('\nFACTURES par année:');
    for (const [y, c] of Object.entries(byYearF).sort()) {
        console.log(`  ${y}: ${c}`);
    }
}

run().finally(() => p.$disconnect());
