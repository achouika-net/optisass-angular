const { PrismaClient } = require('@prisma/client');

async function findIncoherentInvoices() {
    const prisma = new PrismaClient();

    console.log('--- Invoices with Incoherent Installment Totals ---');

    const invoices = await prisma.factureFournisseur.findMany({
        include: { echeances: true }
    });

    let count = 0;
    invoices.forEach(inv => {
        const invTTC = Number(inv.montantTTC || 0);
        const sumEcheances = inv.echeances.reduce((acc, e) => acc + Number(e.montant || 0), 0);

        if (Math.abs(invTTC - sumEcheances) > 10) { // Tolerance of 10 DH
            if (count < 10) {
                console.log(`Invoice ${inv.numeroFacture} (ID: ${inv.id}):`);
                console.log(`  Expected TTC: ${invTTC}`);
                console.log(`  Actual Installments: ${sumEcheances}`);
                console.log(`  Statuses: ${inv.statut}`);
                console.log(`  Installments Count: ${inv.echeances.length}`);
            }
            count++;
        }
    });

    console.log(`Total incoherent invoices: ${count}`);

    await prisma.$disconnect();
}

findIncoherentInvoices();
