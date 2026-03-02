const { PrismaClient } = require('@prisma/client');

async function compareCogsAndPurchases() {
    const prisma = new PrismaClient();
    const start = new Date(1970, 0, 1);
    const end = new Date(3000, 0, 1);

    console.log('--- Comparing COGS vs Purchases (All Time) ---');

    // 1. COGS (from MouvementStock linked to validated Sales)
    const cogsQuery = await prisma.$queryRaw`
    SELECT SUM(m."quantite" * COALESCE(m."prixAchatUnitaire", 0)) as total_cost
    FROM "MouvementStock" m
    JOIN "Facture" f ON m."factureId" = f."id"
    WHERE f."statut" IN ('VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL')
  `;
    const cogsVal = Math.abs(Number(cogsQuery[0]?.total_cost || 0));

    // 2. Purchases (Total TTC of FactureFournisseur inventory types)
    const inventoryTypes = [
        'ACHAT VERRES OPTIQUES',
        'ACHAT MONTURES OPTIQUES',
        'ACHAT LENTILLES DE CONTACT',
        'ACHAT ACCESSOIRES OPTIQUES',
        'ACHAT_STOCK',
    ];
    const purchasesAgg = await prisma.factureFournisseur.aggregate({
        where: { type: { in: inventoryTypes } },
        _sum: { montantTTC: true }
    });
    const purchasesVal = Number(purchasesAgg._sum.montantTTC || 0);

    // 3. OpEx (Total TTC of FactureFournisseur non-inventory types + Depense)
    const operationalTypes = [
        'ELECTRICITE', 'INTERNET', 'ASSURANCE', 'FRAIS BANCAIRES',
        'AUTRES CHARGES', 'REGLEMENT CONSOMMATION EAU',
        'REGLEMENT SALAIRS OPTIQUES', 'LOYER'
    ];

    const purchaseOpExAgg = await prisma.factureFournisseur.aggregate({
        where: {
            OR: [
                { type: { in: operationalTypes } },
                { type: { notIn: inventoryTypes } }
            ]
        },
        _sum: { montantTTC: true }
    });

    const directExpensesAgg = await prisma.depense.aggregate({
        _sum: { montant: true }
    });

    const opexVal = (Number(purchaseOpExAgg._sum.montantTTC || 0)) + (Number(directExpensesAgg._sum.montant || 0));

    console.log(`COGS (Sold): ${cogsVal.toFixed(2)}`);
    console.log(`PURCHASES (Acquired): ${purchasesVal.toFixed(2)}`);
    console.log(`OpEx: ${opexVal.toFixed(2)}`);
    console.log('--- Combinations ---');
    console.log(`COGS + OpEx (Profit Basis): ${(cogsVal + opexVal).toFixed(2)}`);
    console.log(`Purchases + OpEx (Cash Basis): ${(purchasesVal + opexVal).toFixed(2)}`);
    console.log(`Difference: ${(purchasesVal - cogsVal).toFixed(2)}`);

    await prisma.$disconnect();
}

compareCogsAndPurchases();
