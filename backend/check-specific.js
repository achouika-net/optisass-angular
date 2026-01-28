const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSpecific() {
    try {
        const emp = await prisma.employee.findFirst({
            where: { nom: { contains: 'chouika', mode: 'insensitive' } }
        });

        if (!emp) {
            console.log('Employee not found');
            return;
        }

        console.log(`Employee: ${emp.nom} ${emp.prenom} (ID: ${emp.id})`);

        const comms = await prisma.commission.findMany({
            where: { employeeId: emp.id }
        });
        console.log(`Commissions found: ${comms.length}`);
        comms.forEach(c => console.log(` - mois: ${c.mois}, montant: ${c.montant}`));

        const payrolls = await prisma.payroll.findMany({
            where: { employeeId: emp.id }
        });
        console.log(`Payrolls found: ${payrolls.length}`);
        payrolls.forEach(p => console.log(` - mois: ${p.mois}, annee: ${p.annee}, comms: ${p.commissions}`));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkSpecific();
