const { PrismaClient } = require('@prisma/client');

async function checkBlEcheances() {
    const prisma = new PrismaClient();

    console.log('--- Checking for BonLivraison Echeances ---');

    const blEcheances = await prisma.echeancePaiement.aggregate({
        where: { bonLivraisonId: { not: null } },
        _sum: { montant: true },
        _count: { _all: true }
    });

    const invoiceEcheances = await prisma.echeancePaiement.aggregate({
        where: { factureFournisseurId: { not: null } },
        _sum: { montant: true },
        _count: { _all: true }
    });

    const depenseEcheances = await prisma.echeancePaiement.aggregate({
        where: { depense: { isNot: null } },
        _sum: { montant: true },
        _count: { _all: true }
    });

    console.log(`Echeances linked to BL: Count=${blEcheances._count._all}, Sum=${Number(blEcheances._sum.montant || 0).toFixed(2)}`);
    console.log(`Echeances linked to Invoice: Count=${invoiceEcheances._count._all}, Sum=${Number(invoiceEcheances._sum.montant || 0).toFixed(2)}`);
    console.log(`Echeances linked to Depense: Count=${depenseEcheances._count._all}, Sum=${Number(depenseEcheances._sum.montant || 0).toFixed(2)}`);

    // Check overlap (linked to both BL and Invoice)
    const overlap = await prisma.echeancePaiement.count({
        where: { bonLivraisonId: { not: null }, factureFournisseurId: { not: null } }
    });
    console.log(`Echeances linked to BOTH BL and Invoice: ${overlap}`);

    await prisma.$disconnect();
}

checkBlEcheances();
