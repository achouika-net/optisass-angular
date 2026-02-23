const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    console.log('🔍 Breakdown du Reste à Payer et TTC par Année/Type\n');

    const facts = await p.facture.findMany({
        where: { statut: { notIn: ['ARCHIVE', 'ANNULEE'] } },
        select: { type: true, dateEmission: true, totalTTC: true, resteAPayer: true }
    });

    const stats = {};

    for (const f of facts) {
        const year = f.dateEmission?.getFullYear() || 'N/A';
        const type = f.type || 'N/A';
        const key = `${year} | ${type}`;

        if (!stats[key]) stats[key] = { ttc: 0, reste: 0, count: 0 };
        stats[key].ttc += f.totalTTC || 0;
        stats[key].reste += f.resteAPayer || 0;
        stats[key].count++;
    }

    console.log('Année | Type        | Count | Total TTC     | Reste à Payer');
    console.log('-----------------------------------------------------------');
    Object.entries(stats).sort().forEach(([key, s]) => {
        console.log(`${key.padEnd(18)} | ${String(s.count).padEnd(5)} | ${s.ttc.toLocaleString('fr-FR').padEnd(14)} | ${s.reste.toLocaleString('fr-FR')}`);
    });

    // Total sum verification
    let sumTTC = 0; let sumReste = 0;
    Object.values(stats).forEach(s => { sumTTC += s.ttc; sumReste += s.reste; });
    console.log('-----------------------------------------------------------');
    console.log(`TOTAL              |       | ${sumTTC.toLocaleString('fr-FR').padEnd(14)} | ${sumReste.toLocaleString('fr-FR')}`);
}

run().finally(() => p.$disconnect());
