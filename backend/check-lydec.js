
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
        }
    }
});

async function main() {
    const lydecInvoices = await prisma.factureFournisseur.findMany({
        where: { fournisseur: { nom: 'LYDEC' } }
    });
    const lydecExpenses = await prisma.depense.findMany({
        where: { description: { contains: 'LYDEC', mode: 'insensitive' } }
    });

    console.log(`LYDEC Invoices: ${lydecInvoices.length}`);
    lydecInvoices.forEach(i => console.log(`  - Inv: ${i.numeroFacture}, Amount: ${i.montantTTC}`));

    console.log(`LYDEC Expenses: ${lydecExpenses.length}`);
    lydecExpenses.forEach(e => console.log(`  - Exp: ${e.description}, Amount: ${e.montant}, FactureLink: ${e.factureFournisseurId}`));

    await prisma.$disconnect();
}

main();
