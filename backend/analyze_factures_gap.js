const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    // The 155 "missing" factures: check if they're actually FACTURE type documents
    // (they may have already been reclassified - let's see all FACTUREs with xx/year numbering)
    const facturesWithSlash = await p.facture.count({
        where: { type: 'FACTURE', numero: { contains: '/' }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } }
    });
    const facturesWithoutSlash = await p.facture.count({
        where: { type: 'FACTURE', NOT: { numero: { contains: '/' } }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } }
    });
    const totalFactures = await p.facture.count({
        where: { type: 'FACTURE', statut: { notIn: ['ARCHIVE', 'ANNULEE'] } }
    });

    console.log('\n🧾 ANALYSE FACTURES\n');
    console.log(`Total FACTURE (non-archivées) : ${totalFactures}  (référence: 2843)`);
    console.log(`  Avec numéro xx/yyyy         : ${facturesWithSlash}`);
    console.log(`  Avec numéro continu         : ${facturesWithoutSlash}`);

    // Also look at any possible DEVIS with xx/year format that might have been missed
    const devisWithSlash = await p.facture.count({
        where: { type: 'DEVIS', numero: { contains: '/' } }
    });
    console.log(`\nDEVIS (encore) avec xx/yyyy   : ${devisWithSlash}  (these may need reclassification)`);

    // Breakdown by statut
    const allFactures = await p.facture.findMany({
        where: { statut: { notIn: ['ARCHIVE', 'ANNULEE'] } },
        select: { type: true, statut: true }
    });
    const typeMap = {};
    for (const f of allFactures) {
        typeMap[f.type] = (typeMap[f.type] || 0) + 1;
    }
    console.log('\n📊 Tous les types de documents (non-archivés) :');
    for (const [k, v] of Object.entries(typeMap).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${(k || 'null').padEnd(20)} : ${v}`);
    }

    console.log('\nTotal tous types: ' + allFactures.length + '  (factures + BC = ' + totalFactures + '+' +
        (await p.facture.count({ where: { type: { in: ['BON_COMM', 'BON_COMMANDE'] }, statut: { notIn: ['ARCHIVE', 'ANNULEE'] } } })) + ')');
}

run().finally(() => p.$disconnect());
