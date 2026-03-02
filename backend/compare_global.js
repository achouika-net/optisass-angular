const { PrismaClient } = require('@prisma/client');

async function compareGlobal() {
    const prisma = new PrismaClient();

    const factures = await prisma.factureFournisseur.aggregate({
        _sum: { montantTTC: true }
    });

    const echeances = await prisma.echeancePaiement.aggregate({
        where: { factureFournisseurId: { not: null } },
        _sum: { montant: true }
    });

    console.log('FactureFournisseur.montantTTC SUM:', factures._sum.montantTTC);
    console.log('EcheancePaiement.montant SUM (linked to Invoice):', echeances._sum.montant);
    console.log('Difference:', Number(echeances._sum.montant || 0) - Number(factures._sum.montantTTC || 0));

    await prisma.$disconnect();
}

compareGlobal();
