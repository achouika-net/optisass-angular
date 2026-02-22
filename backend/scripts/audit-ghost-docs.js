const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const allDocs = await prisma.facture.findMany({
        where: { centreId, statut: { not: 'ANNULEE' } }
    });

    const ghosts = [];
    let ghostSum = 0;

    for (const f of allDocs) {
        const isFacture = ((f.numero || '').startsWith('FAC') || f.type === 'FACTURE') &&
            !['VENTE_EN_INSTANCE', 'ARCHIVE'].includes(f.statut) &&
            f.type !== 'AVOIR';

        const isBC = (['BON_COMMANDE', 'BON_COMM'].includes(f.type) || (f.numero || '').startsWith('BC') || f.statut === 'VENTE_EN_INSTANCE') &&
            !['ARCHIVE'].includes(f.statut);

        if (!isFacture && !isBC) {
            ghosts.push(f);
            ghostSum += (f.resteAPayer || 0);
        }
    }

    console.log('--- Ghost Documents Audit ---');
    console.log('Total Docs not in Facture or BC metrics:', ghosts.length);
    console.log('Sum Reste of these ghosts:', ghostSum, 'DH');

    if (ghosts.length > 0) {
        console.log('\nSamples of Ghost Docs:');
        console.log(ghosts.slice(0, 5).map(g => ({ num: g.numero, type: g.type, statut: g.statut, reste: g.resteAPayer })));

        // Group by Type/Statut
        const groups = {};
        for (const g of ghosts) {
            const key = `${g.type} | ${g.statut}`;
            groups[key] = (groups[key] || 0) + g.resteAPayer;
        }
        console.log('\nGrouped Reste by Type|Statut:', JSON.stringify(groups, null, 2));
    }

    await prisma.$disconnect();
}

run();
