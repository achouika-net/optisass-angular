const { PrismaClient } = require('@prisma/client');

async function findDarkData() {
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
                montant: true
            }
        });

        console.log(`Total Payments: ${payments.length}`);
        let total = 0;
        let nullDateCount = 0;
        let nullDateAmount = 0;
        let before2025Count = 0;
        let before2025Amount = 0;

        payments.forEach(pay => {
            const amount = pay.montant || 0;
            total += amount;
            if (!pay.date) {
                nullDateCount++;
                nullDateAmount += amount;
            } else if (pay.date.getFullYear() < 2025) {
                before2025Count++;
                before2025Amount += amount;
                if (before2025Count < 5) console.log(`Very old payment: ${pay.date.toISOString()} - ${amount}`);
            }
        });

        console.log(`\nAggregated Payment Stats:`);
        console.log(`Total Amount: ${total}`);
        console.log(`NULL Dates: ${nullDateCount} rows, ${nullDateAmount} DH`);
        console.log(`Pre-2025 Dates: ${before2025Count} rows, ${before2025Amount} DH`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await p.$disconnect();
    }
}

findDarkData();
