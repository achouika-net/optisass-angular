const { PrismaClient } = require('@prisma/client');

async function checkRabat() {
    const prisma = new PrismaClient();

    // Find Rabat ID
    const rabat = await prisma.centre.findFirst({ where: { nom: { contains: 'RABAT', mode: 'insensitive' } } });
    if (!rabat) {
        console.log('Centre Rabat not found');
        return;
    }
    const tenantId = rabat.id;
    console.log(`Diagnostic for Centre Rabat (${tenantId}):`);

    // 1. Invoices (montantTTC)
    const invAgg = await prisma.factureFournisseur.aggregate({
        where: { centreId: tenantId },
        _sum: { montantTTC: true }
    });

    // 2. Installments (montant)
    const echAgg = await prisma.echeancePaiement.aggregate({
        where: {
            statut: { not: 'ANNULE' },
            OR: [
                { depense: { centreId: tenantId } },
                { factureFournisseur: { centreId: tenantId } }
            ]
        },
        _sum: { montant: true }
    });

    // 3. Direct Expenses (no echeance)
    const depAgg = await prisma.depense.aggregate({
        where: { centreId: tenantId, echeanceId: null },
        _sum: { montant: true }
    });

    console.log(`Invoices Total (Rabat): ${Number(invAgg._sum.montantTTC || 0).toFixed(2)}`);
    console.log(`Installments Total (Rabat): ${Number(echAgg._sum.montant || 0).toFixed(2)}`);
    console.log(`Direct Expenses (Rabat): ${Number(depAgg._sum.montant || 0).toFixed(2)}`);
    console.log(`Combined (Installments + Direct): ${(Number(echAgg._sum.montant || 0) + Number(depAgg._sum.montant || 0)).toFixed(2)}`);

    await prisma.$disconnect();
}

checkRabat();
