const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditCommissions() {
    try {
        const commissions = await prisma.commission.findMany({
            include: {
                employee: { select: { nom: true, prenom: true, id: true, matricule: true } },
                facture: { select: { numero: true, totalTTC: true, dateEmission: true, statut: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        console.log(`\n--- ALL RECENT COMMISSIONS (${commissions.length} items) ---`);
        commissions.forEach(c => {
            console.log(`[${c.mois}] ${c.employee.nom} ${c.employee.prenom} | Fac: ${c.facture.numero} | Montant: ${c.montant} DH | Type: ${c.type} | Created: ${c.createdAt.toISOString()}`);
        });

        const payrolls = await prisma.payroll.findMany({
            orderBy: [{ annee: 'desc' }, { mois: 'desc' }],
            take: 10
        });
        console.log('\n--- RECENT PAYROLLS ---');
        payrolls.forEach(p => {
            console.log(`[${p.annee}-${p.mois}] EmpID: ${p.employeeId} | Comms: ${p.commissions} | Net: ${p.netAPayer} | Statut: ${p.statut}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

auditCommissions();
