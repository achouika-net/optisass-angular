const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    console.log('🔍 Recherche Pattern de l\'Ecart de 1.15M\n');

    // Find documents with the largest reste à payer
    const topReste = await p.facture.findMany({
        where: { resteAPayer: { gt: 0 } },
        orderBy: { resteAPayer: 'desc' },
        take: 20,
        include: { client: true }
    });

    console.log('📋 Top 20 documents par Reste à Payer :');
    for (const f of topReste) {
        console.log(`   ${f.numero.padEnd(10)} | TTC: ${f.totalTTC.toFixed(2).padEnd(10)} | Payé: ${(f.totalTTC - f.resteAPayer).toFixed(2).padEnd(10)} | Reste: ${f.resteAPayer.toFixed(2).padEnd(10)} | Client: ${f.client.nom} ${f.client.prenom}`);
    }

    // Check if there are documents where totalTTC is abnormally high
    // (e.g. > 100,000 DH if they are mostly fiches optiques)
    const veryHigh = await p.facture.count({ where: { totalTTC: { gt: 50000 } } });
    console.log(`\n⚠️  Documents avec Total TTC > 50 000 DH : ${veryHigh}`);

    // Check for any obvious duplicates (same amount, same client, same date)
    // This is harder to query easily, but we can check if some numbers are duplicated or have a suffix
}

run().finally(() => p.$disconnect());
