const { PrismaClient } = require('@prisma/client');

async function findMegaPayments() {
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
            where: { statut: { not: 'ANNULE' } },
            select: {
                date: true,
                montant: true,
                facture: {
                    select: {
                        numero: true,
                        statut: true,
                        type: true
                    }
                }
            }
        });

        console.log(`Total active payments: ${payments.length}`);

        const monthlyGroups = {};
        payments.forEach(pay => {
            const m = pay.date ? pay.date.toISOString().substring(0, 7) : 'NULL';
            monthlyGroups[m] = (monthlyGroups[m] || 0) + (pay.montant || 0);
        });

        console.log('Monthly Incoming Totals (from Paiement table):');
        console.log(JSON.stringify(monthlyGroups, null, 2));

        // Find the top 5 largest payments
        const top5 = payments.sort((a, b) => (b.montant || 0) - (a.montant || 0)).slice(0, 5);
        console.log('\nTop 5 Largest Payments:');
        top5.forEach(p => {
            console.log(`Amount: ${p.montant}, Date: ${p.date?.toISOString()}, Facture: ${p.facture?.numero} (Status: ${p.facture?.statut})`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await p.$disconnect();
    }
}

findMegaPayments();
