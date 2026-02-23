const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    const total = await p.fiche.count();
    console.log(`\n📋 ANALYSE DES FICHES (total: ${total} — référence: 13235 — écart: ${total - 13235})\n`);

    const fiches = await p.fiche.findMany({
        select: { type: true, statut: true, dateCreation: true, clientId: true }
    });

    const tkMap = {};
    const stMap = {};
    for (const f of fiches) {
        const k = f.type || 'null';
        tkMap[k] = (tkMap[k] || 0) + 1;
        const sk = f.statut || 'null';
        stMap[sk] = (stMap[sk] || 0) + 1;
    }

    console.log('Répartition par type (M=Monture, L=Lentilles) :');
    for (const [k, v] of Object.entries(tkMap).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${k.padEnd(20)} : ${v}`);
    }

    console.log('\nRépartition par statut :');
    for (const [k, v] of Object.entries(stMap).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${k.padEnd(20)} : ${v}`);
    }

    // 5 most recent fiches
    const latest = await p.fiche.findMany({
        orderBy: { dateCreation: 'desc' },
        take: 5,
        select: { id: true, type: true, statut: true, dateCreation: true, clientId: true }
    });
    console.log('\n5 dernières fiches créées :');
    for (const f of latest) {
        console.log(`   ${f.id.substring(0, 8)} | ${(f.type || '?').padEnd(10)} | ${(f.statut || '?').padEnd(15)} | ${f.dateCreation?.toISOString().substring(0, 10)}`);
    }
}

run().finally(() => p.$disconnect());
