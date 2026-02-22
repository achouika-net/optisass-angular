const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';

    const archived = await prisma.facture.findMany({
        where: { centreId, statut: 'ARCHIVE' }
    });

    const sum = archived.reduce((s, x) => s + (x.resteAPayer || 0), 0);
    console.log('--- Archive Audit ---');
    console.log('ARCHIVE docs:', archived.length);
    console.log('Sum Reste in ARCHIVE:', sum, 'DH');

    const annulled = await prisma.facture.findMany({
        where: { centreId, statut: 'ANNULEE' }
    });
    const sumAnnulled = annulled.reduce((s, x) => s + (x.resteAPayer || 0), 0);
    console.log('\n--- Annulled Audit ---');
    console.log('ANNULEE docs:', annulled.length);
    console.log('Sum Reste in ANNULEE:', sumAnnulled, 'DH');

    await prisma.$disconnect();
}

run();
