const { PrismaClient } = require('@prisma/client');

async function auditFactures() {
    const p = new PrismaClient({
        datasources: {
            db: {
                url: "postgresql://postgres:admin@localhost:5432/optisaas?schema=public"
            }
        }
    });

    try {
        await p.$connect();
        const factures = await p.facture.findMany({
            select: {
                dateEmission: true,
                totalTTC: true,
                totalHT: true,
                type: true,
                statut: true,
                numero: true
            }
        });

        console.log(`Total Invoices: ${factures.length}`);

        const summary = factures.map(f => ({
            month: f.dateEmission.toISOString().substring(0, 7),
            type: f.type,
            statut: f.statut,
            totalHT: f.totalHT
        }));

        console.log('Invoice Summary by Month/Type/Status:');
        const grouped = {};
        summary.forEach(s => {
            const key = `${s.month} | ${s.type} | ${s.statut}`;
            grouped[key] = (grouped[key] || 0) + 1;
        });
        console.table(grouped);

        // Check specifically for active statuses used in Real Profit
        const activeStatuses = ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL'];
        const activeCount = factures.filter(f => activeStatuses.includes(f.statut)).length;
        console.log(`Invoices with Active Statuses: ${activeCount}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await p.$disconnect();
    }
}

auditFactures();
