const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    console.log('🔍 Audit des Documents Totalement Impayés\n');

    const fullyUnpaid = await p.facture.findMany({
        where: {
            statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
            paiements: { none: {} },
            totalTTC: { gt: 0 }
        },
        select: { numero: true, totalTTC: true, type: true, dateEmission: true, client: { select: { nom: true } } },
        orderBy: { totalTTC: 'desc' }
    });

    const sumUnpaid = fullyUnpaid.reduce((s, f) => s + f.totalTTC, 0);

    console.log(`📋 Nombre de documents sans aucun paiement : ${fullyUnpaid.length}`);
    console.log(`   Somme TTC de ces documents : ${sumUnpaid.toLocaleString('fr-FR')} DH`);

    console.log('\n   Top 20 documents impayés :');
    fullyUnpaid.slice(0, 20).forEach(f => {
        console.log(`   - ${f.numero.padEnd(10)} | ${f.type.padEnd(12)} | ${f.totalTTC.toFixed(2).padEnd(10)} | ${f.dateEmission.toISOString().substring(0, 10)} | ${f.client.nom}`);
    });

    // Also check for documents with "Partial" payments but very high remainders
    const partial = await p.facture.findMany({
        where: {
            statut: { notIn: ['ARCHIVE', 'ANNULEE'] },
            paiements: { some: {} },
            resteAPayer: { gt: 1000 }
        },
        include: { paiements: true, client: { select: { nom: true } } }
    });

    const sumPartialReste = partial.reduce((s, f) => s + f.resteAPayer, 0);
    console.log(`\n📋 Documents partiellement payés (Reste > 1000 DH) : ${partial.length}`);
    console.log(`   Somme des Restes partiels : ${sumPartialReste.toLocaleString('fr-FR')} DH`);
}

run().finally(() => p.$disconnect());
