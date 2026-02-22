import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const centreId = '6df7de62-498e-4784-b22f-7bbccc7fea36';
    const start = new Date('2000-01-01T00:00:00.000Z');
    const end = new Date('2026-02-21T23:59:59.999Z');

    // 1. Replicate Dashboard Query exactly
    const dashboardFactures = await prisma.facture.findMany({
        where: {
            centreId,
            OR: [
                { numero: { startsWith: 'FAC' } },
                { type: 'FACTURE' }
            ],
            statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] },
            type: { not: 'AVOIR' },
            dateEmission: { gte: start, lte: end }
        }
    });

    const dashboardSum = dashboardFactures.reduce((s, x) => s + (x.totalTTC || 0), 0);
    console.log('Dashboard Sum (Strict):', dashboardSum);

    // 2. Find anything that matches the type/status but fails the date filter
    const outOfRangeFactures = await prisma.facture.findMany({
        where: {
            centreId,
            AND: [
                {
                    OR: [
                        { numero: { startsWith: 'FAC' } },
                        { type: 'FACTURE' }
                    ]
                },
                { statut: { notIn: ['VENTE_EN_INSTANCE', 'ANNULEE', 'ARCHIVE'] } },
                { type: { not: 'AVOIR' } },
                {
                    OR: [
                        { dateEmission: { lt: start } },
                        { dateEmission: { gt: end } }
                    ]
                }
            ]
        }
    });

    console.log('Factures Out of Range:', outOfRangeFactures.length);
    const outSum = outOfRangeFactures.reduce((s, x) => s + (x.totalTTC || 0), 0);
    console.log('Total Out of Range Sum:', outSum);

    if (outOfRangeFactures.length > 0) {
        console.log('Sample out of range:', outOfRangeFactures.slice(0, 3).map(f => ({
            num: f.numero,
            date: f.dateEmission,
            ttc: f.totalTTC
        })));
    }

    // 3. Duplicate Payments Deep Dive
    const allPaid = await prisma.paiement.findMany({
        where: { facture: { centreId: centreId } },
        select: {
            id: true,
            montant: true,
            date: true,
            mode: true,
            factureId: true,
            facture: { select: { numero: true } }
        }
    });

    const groups = new Map<string, any[]>();
    for (const p of allPaid) {
        const d = p.date ? new Date(p.date).toISOString() : 'null';
        const key = `${p.factureId}_${p.montant}_${d}_${p.mode}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(p);
    }

    let dupCount = 0;
    let dupSum = 0;
    const samples: any[] = [];
    for (const [, list] of groups.entries()) {
        if (list.length > 1) {
            const extra = list.length - 1;
            dupCount += extra;
            dupSum += (extra * list[0].montant);
            samples.push({
                num: list[0].facture.numero,
                count: list.length,
                montant: list[0].montant
            });
        }
    }

    console.log('\n--- Duplicate Payments Detail ---');
    console.log('Duplicate Count:', dupCount);
    console.log('Duplicate Sum:', dupSum);
    console.log('Samples:', samples.slice(0, 5));

    await prisma.$disconnect();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
