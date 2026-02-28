const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function main() {
    const [dCount, fCount, eCount, pCount] = await Promise.all([
        prisma.depense.count(),
        prisma.factureFournisseur.count(),
        prisma.echeancePaiement.count(),
        prisma.paiement.count()
    ]);

    console.log('--- DB COUNTS ---');
    console.log('FactureFournisseur:', fCount);
    console.log('EcheancePaiement:', eCount);
    console.log('Depense:', dCount);
    console.log('Paiement:', pCount);

    const generatedInvoices = await prisma.factureFournisseur.count({
        where: { numeroFacture: { startsWith: 'IMP_BL_SANS_NUM' } }
    });
    console.log('Generated Invoices (IMP_BL_SANS_NUM):', generatedInvoices);

    const salaryExpenses = await prisma.depense.count({
        where: { description: { contains: 'SALAIRE', mode: 'insensitive' } }
    });
    console.log('Salary Expenses:', salaryExpenses);

    const firstExpenses = await prisma.depense.findMany({ take: 5 });
    console.log('SAMPLE EXPENSES:', JSON.stringify(firstExpenses, null, 2));

    await prisma.$disconnect();
}

main();
