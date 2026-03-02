const { PrismaClient } = require('@prisma/client');

async function checkInstallmentIntegrity() {
    const prisma = new PrismaClient();

    console.log('--- Checking Installment Integrity ---');

    const invoices = await prisma.factureFournisseur.findMany({
        include: { echeances: true }
    });

    let totalInvoiceTTC = 0;
    let totalInstallments = 0;
    let mismatchCount = 0;

    invoices.forEach(inv => {
        const invTTC = Number(inv.montantTTC || 0);
        const sumEcheances = inv.echeances.reduce((acc, e) => acc + Number(e.montant || 0), 0);

        totalInvoiceTTC += invTTC;
        totalInstallments += sumEcheances;

        if (Math.abs(invTTC - sumEcheances) > 1) {
            if (mismatchCount < 5) {
                console.log(`Mismatch for Invoice ${inv.numeroFacture}: TTC=${invTTC}, SumEcheances=${sumEcheances}`);
            }
            mismatchCount++;
        }
    });

    console.log(`Total Invoices TTC: ${totalInvoiceTTC.toFixed(2)}`);
    console.log(`Total Installments related: ${totalInstallments.toFixed(2)}`);
    console.log(`Mismatch Count: ${mismatchCount}`);

    // Check for installments NOT linked to an invoice (linked to Depense)
    const orphanedEcheances = await prisma.echeancePaiement.aggregate({
        where: { factureFournisseurId: null, depenseId: { not: null } },
        _sum: { montant: true }
    });
    console.log(`Installments linked to Depense: ${Number(orphanedEcheances._sum.montant || 0).toFixed(2)}`);

    await prisma.$disconnect();
}

checkInstallmentIntegrity();
