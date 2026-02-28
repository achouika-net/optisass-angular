
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
        }
    }
});

async function main() {
    const salaryInvoices = await prisma.factureFournisseur.findMany({
        where: {
            OR: [
                { fournisseur: { nom: { contains: 'SALAIRE', mode: 'insensitive' } } },
                { numeroFacture: { contains: 'SALAIRE', mode: 'insensitive' } }
            ]
        },
        include: { fournisseur: true }
    });

    console.log(`Salary Invoices in FactureFournisseur: ${salaryInvoices.length}`);
    salaryInvoices.forEach(i => console.log(`  - Inv: ${i.numeroFacture}, Supplier: ${i.fournisseur.nom}, Amount: ${i.montantTTC}`));

    await prisma.$disconnect();
}

main();
