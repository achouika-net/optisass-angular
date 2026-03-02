const { PrismaClient } = require('@prisma/client');

async function findExceeding() {
    const prisma = new PrismaClient();
    console.log('--- Invoices where installments > TTC ---');

    const invoices = await prisma.factureFournisseur.findMany({
        include: { echeances: true }
    });

    let count = 0;
    let totalExceed = 0;

    invoices.forEach(inv => {
        const invTTC = Number(inv.montantTTC || 0);
        const sumEcheances = inv.echeances.reduce((acc, e) => acc + Number(e.montant || 0), 0);

        if (sumEcheances > invTTC + 1) {
            if (count < 10) {
                console.log(`Invoice ${inv.numeroFacture}: TTC=${invTTC.toFixed(2)}, SumEcheances=${sumEcheances.toFixed(2)} (Diff: ${(sumEcheances - invTTC).toFixed(2)})`);
            }
            count++;
            totalExceed += (sumEcheances - invTTC);
        }
    });

    console.log(`Total exceeding invoices: ${count}`);
    console.log(`Total excess amount: ${totalExceed.toFixed(2)}`);

    await prisma.$disconnect();
}

findExceeding();
