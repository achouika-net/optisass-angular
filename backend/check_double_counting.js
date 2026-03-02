const { PrismaClient } = require('@prisma/client');

async function checkDoubleCounting() {
    const prisma = new PrismaClient();

    console.log('--- Checking for Depense <-> FactureFournisseur Overlap ---');

    // Total Depense
    const totalDepense = await prisma.depense.aggregate({ _sum: { montant: true } });

    // Total Depense linked to a FactureFournisseur
    const linkedDepense = await prisma.depense.aggregate({
        where: { factureFournisseurId: { not: null } },
        _sum: { montant: true }
    });

    // Total FactureFournisseur (Operational only)
    const inventoryTypes = [
        'ACHAT VERRES OPTIQUES', 'ACHAT MONTURES OPTIQUES', 'ACHAT LENTILLES DE CONTACT', 'ACHAT ACCESSOIRES OPTIQUES', 'ACHAT_STOCK'
    ];
    const totalOpFactures = await prisma.factureFournisseur.aggregate({
        where: { type: { notIn: inventoryTypes } },
        _sum: { montantTTC: true }
    });

    console.log(`Total Depense: ${Number(totalDepense._sum.montant || 0).toFixed(2)}`);
    console.log(`Linked Depense (to Invoice): ${Number(linkedDepense._sum.montant || 0).toFixed(2)}`);
    console.log(`Operational Invoices: ${Number(totalOpFactures._sum.montantTTC || 0).toFixed(2)}`);

    await prisma.$disconnect();
}

checkDoubleCounting();
