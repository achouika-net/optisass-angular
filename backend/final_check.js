const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    console.log('🔍 Vérification finale des points et du CA\n');

    const topPoints = await p.client.findMany({
        where: { pointsFidelite: { gt: 0 } },
        orderBy: { pointsFidelite: 'desc' },
        take: 10,
        select: { id: true, nom: true, prenom: true, pointsFidelite: true }
    });

    console.log('📋 Top 10 Clients par Points :');
    if (topPoints.length === 0) {
        console.log('   ❌ Aucun client n\'a de points ( > 0 ) dans la base !');
    } else {
        topPoints.forEach(c => {
            console.log(`   - ${c.nom} ${c.prenom} : ${c.pointsFidelite} pts`);
        });
    }

    const totalPointsSum = await p.client.aggregate({
        _sum: { pointsFidelite: true }
    });
    console.log(`\n💰 Somme totale des points clients : ${totalPointsSum._sum.pointsFidelite || 0}`);

    const historyCount = await p.pointsHistory.count();
    console.log(`📜 Nombre d'entrées History : ${historyCount}`);

    // Verification specific example
    const ghandour = await p.client.findFirst({
        where: { nom: { contains: 'GHANDOUR', mode: 'insensitive' } },
        select: { nom: true, prenom: true, pointsFidelite: true, factures: { select: { numero: true, totalTTC: true } } }
    });
    if (ghandour) {
        console.log(`\n📍 Focus GHANDOUR :`);
        console.log(`   Points : ${ghandour.pointsFidelite}`);
        ghandour.factures.forEach(f => console.log(`   - Doc ${f.numero} : ${f.totalTTC} DH`));
    }
}

run().finally(() => p.$disconnect());
