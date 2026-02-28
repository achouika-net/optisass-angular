const { PrismaClient } = require('@prisma/client');

async function auditPayments() {
    const p = new PrismaClient({
        datasources: {
            db: {
                url: "postgresql://postgres:admin@localhost:5432/optisaas?schema=public"
            }
        }
    });

    try {
        await p.$connect();
        const payments = await p.paiement.findMany({
            select: {
                date: true,
                montant: true,
                statut: true
            }
        });

        console.log(`Total Payments: ${payments.length}`);
        const totalAmount = payments.reduce((sum, p) => sum + (p.montant || 0), 0);
        console.log(`Total Payment Amount: ${totalAmount}`);

        const summary = payments.map(p => ({
            month: p.date ? p.date.toISOString().substring(0, 7) : 'NULL',
            statut: p.statut
        }));

        console.log('Payment Summary by Month/Status:');
        const grouped = {};
        summary.forEach(s => {
            const key = `${s.month} | ${s.statut}`;
            grouped[key] = (grouped[key] || 0) + 1;
        });
        console.table(grouped);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await p.$disconnect();
    }
}

auditPayments();
