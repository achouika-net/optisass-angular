const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncPayrolls() {
    try {
        const moisPattern = '01';
        const anneePattern = 2026;
        const fullMois = `${anneePattern}-${moisPattern}`;

        const payrolls = await prisma.payroll.findMany({
            where: { mois: moisPattern, annee: anneePattern }
        });

        console.log(`\n--- SYNCING PAYROLLS FOR ${anneePattern}-${moisPattern} ---`);

        for (const p of payrolls) {
            console.log(`Checking payroll for Employee ${p.employeeId}...`);

            const aggregations = await prisma.commission.aggregate({
                where: { employeeId: p.employeeId, mois: fullMois },
                _sum: { montant: true }
            });
            const totalCommissions = aggregations._sum.montant || 0;

            if (totalCommissions !== p.commissions) {
                console.log(`   Updating commissions: ${p.commissions} -> ${totalCommissions}`);
                const netAPayer = p.salaireBase + totalCommissions + p.heuresSup - p.retenues;

                await prisma.payroll.update({
                    where: { id: p.id },
                    data: {
                        commissions: totalCommissions,
                        netAPayer: netAPayer
                    }
                });
                console.log(`   ✅ Success!`);
            } else {
                console.log(`   Commissions already up to date (${totalCommissions}).`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

syncPayrolls();
