const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAll() {
    try {
        const comms = await prisma.commission.findMany({
            include: { employee: true }
        });

        const summary = {};
        comms.forEach(c => {
            const key = `${c.employee.nom} ${c.employee.prenom}`;
            if (!summary[key]) summary[key] = 0;
            summary[key] += c.montant;
        });

        console.log('--- COMMISSION SUMMARY BY EMPLOYEE ---');
        console.log(summary);

        const payrolls = await prisma.payroll.findMany({
            include: { employee: true }
        });
        console.log('\n--- PAYROLL SUMMARY BY EMPLOYEE ---');
        payrolls.forEach(p => {
            console.log(`${p.employee.nom} ${p.employee.prenom} | Mois: ${p.mois}/${p.annee} | Comms: ${p.commissions}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkAll();
