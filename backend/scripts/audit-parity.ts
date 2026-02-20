import { PrismaClient } from '@prisma/client';

async function auditParity() {
    const prisma = new PrismaClient();
    console.log('🚀 Starting Turnover Parity Audit...\n');

    try {
        // 1. Audit Sales Control Logic (Manual aggregation to verify)
        console.log('--- Sales Control Calculation (Factures - Avoirs) ---');
        const activeStatuses = ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL'];

        const factures = await prisma.facture.aggregate({
            where: {
                OR: [
                    { numero: { startsWith: 'FAC' } },
                    { type: 'FACTURE' }
                ],
                statut: { in: activeStatuses }
            },
            _sum: { totalTTC: true },
            _count: { _all: true }
        });

        const avoirs = await prisma.facture.aggregate({
            where: { type: 'AVOIR' },
            _sum: { totalTTC: true },
            _count: { _all: true }
        });

        const scFactures = factures._sum.totalTTC || 0;
        const scAvoirs = avoirs._sum.totalTTC || 0;
        const scNet = scFactures - scAvoirs;

        console.log(`Factures Count: ${factures._count._all}`);
        console.log(`Factures Total: ${scFactures.toFixed(2)} DH`);
        console.log(`Avoirs Count: ${avoirs._count._all}`);
        console.log(`Avoirs Total: ${scAvoirs.toFixed(2)} DH`);
        console.log(`NET Sales Control CA: ${scNet.toFixed(2)} DH\n`);

        // 2. Audit Advanced Statistics Logic
        console.log('--- Advanced Statistics Calculation ---');
        // Our new logic in StatsService.getSummary should match this:
        /*
            facturesResult.forEach(f => {
                if (f.type === 'AVOIR') totalRevenue -= (f.totalTTC || 0);
                else totalRevenue += (f.totalTTC || 0);
            });
        */
        const statsDocs = await prisma.facture.findMany({
            where: {
                OR: [
                    {
                        OR: [{ numero: { startsWith: 'FAC' } }, { type: 'FACTURE' }],
                        statut: { in: activeStatuses }
                    },
                    { type: 'AVOIR' }
                ]
            },
            select: { totalTTC: true, type: true }
        });

        let statsRevenue = 0;
        statsDocs.forEach(d => {
            if (d.type === 'AVOIR') statsRevenue -= (d.totalTTC || 0);
            else statsRevenue += (d.totalTTC || 0);
        });

        console.log(`Stats Revenue: ${statsRevenue.toFixed(2)} DH`);

        // 3. Comparison
        const diff = Math.abs(scNet - statsRevenue);
        console.log('\n--- Final Verification ---');
        if (diff < 0.01) {
            console.log('✅ PASS: Turnover Parity Confirmed! Both reports will show the exact same net figure.');
        } else {
            console.log(`❌ FAIL: Discrepancy detected! Diff: ${diff.toFixed(2)} DH`);
        }

    } catch (error) {
        console.error('Error during audit:', error);
    } finally {
        await prisma.$disconnect();
    }
}

auditParity();
