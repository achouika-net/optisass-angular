const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectFormats() {
    try {
        const payrolls = await prisma.payroll.findMany({ take: 5 });
        console.log('--- PAYROLL SAMPLES ---');
        payrolls.forEach(p => console.log(`ID: ${p.id}, Mois: "${p.mois}", Annee: ${p.annee}`));

        const commissions = await prisma.commission.findMany({ take: 5 });
        console.log('\n--- COMMISSION SAMPLES ---');
        commissions.forEach(c => console.log(`ID: ${c.id}, Mois: "${c.mois}"`));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

inspectFormats();
