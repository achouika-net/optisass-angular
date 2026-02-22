const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Diagnostic ---');

    // Check Invoices (Facture)
    const totalInvoices = await prisma.facture.count();
    console.log(`Total Invoices: ${totalInvoices}`);

    const recentInvoices = await prisma.facture.findMany({
        take: 5,
        orderBy: { dateEmission: 'desc' },
        select: { numero: true, dateEmission: true, totalHT: true, type: true, statut: true, centreId: true }
    });
    console.log('Recent Invoices:');
    recentInvoices.forEach(f => console.log(`- ${f.numero}: ${f.dateEmission.toISOString()} | ${f.totalHT} | ${f.type} | ${f.statut} | center: ${f.centreId}`));

    // Check 2023 Invoices
    const start2023 = new Date('2023-01-01');
    const end2023 = new Date('2023-12-31');
    const count2023 = await prisma.facture.count({
        where: { dateEmission: { gte: start2023, lte: end2023 } }
    });
    console.log(`Invoices in 2023: ${count2023}`);

    // Check Expenses
    const totalExpenses = await prisma.depense.count();
    console.log(`Total Expenses: ${totalExpenses}`);

    const centers = await prisma.centre.findMany({ select: { id: true, nom: true } });
    console.log(`Centers: ${JSON.stringify(centers)}`);

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
