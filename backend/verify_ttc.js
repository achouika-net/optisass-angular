const { PrismaClient } = require('@prisma/client');

async function verifyTTC() {
    const prisma = new PrismaClient();
    const start = new Date(1970, 0, 1);
    const end = new Date(3000, 0, 1);

    console.log('--- Checking All-TTC Totals ---');

    // Revenue (Facture)
    const revenueAgg = await prisma.facture.aggregate({
        where: {
            dateEmission: { gte: start, lte: end },
            OR: [
                { type: { in: ['FACTURE', 'BON_COMMANDE'] }, statut: { in: ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL'] } },
                { type: 'AVOIR' },
            ],
        },
        _sum: { totalHT: true, totalTTC: true }
    });

    // Note: Since our logic uses COALESCE(totalHT, totalTTC), we'll simulate that
    const revenueDocs = await prisma.facture.findMany({
        where: {
            dateEmission: { gte: start, lte: end },
            OR: [
                { type: { in: ['FACTURE', 'BON_COMMANDE'] }, statut: { in: ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL'] } },
                { type: 'AVOIR' },
            ],
        },
        select: { totalHT: true, totalTTC: true, type: true }
    });

    let totalRevenue = 0;
    revenueDocs.forEach(d => {
        let val = d.totalHT || d.totalTTC || 0;
        if (d.type === 'AVOIR') totalRevenue -= val;
        else totalRevenue += val;
    });

    // COGS (FactureFournisseur - Inventory)
    const cogsAgg = await prisma.factureFournisseur.aggregate({
        where: {
            type: { in: ['ACHAT VERRES OPTIQUES', 'ACHAT MONTURES OPTIQUES', 'ACHAT LENTILLES DE CONTACT', 'ACHAT ACCESSOIRES OPTIQUES', 'ACHAT_STOCK'] }
        },
        _sum: { montantHT: true, montantTTC: true }
    });

    // Expenses (Depense + FactureFournisseur - Operational)
    const depenseAgg = await prisma.depense.aggregate({
        _sum: { montant: true }
    });

    const operationalPurchasesAgg = await prisma.factureFournisseur.aggregate({
        where: {
            type: { notIn: ['ACHAT VERRES OPTIQUES', 'ACHAT MONTURES OPTIQUES', 'ACHAT LENTILLES DE CONTACT', 'ACHAT ACCESSOIRES OPTIQUES', 'ACHAT_STOCK'] }
        },
        _sum: { montantHT: true, montantTTC: true }
    });

    console.log('REVENUE (TTC-like/Fallback):', totalRevenue.toFixed(2));
    console.log('COGS HT:', cogsAgg._sum.montantHT?.toFixed(2));
    console.log('COGS TTC:', cogsAgg._sum.montantTTC?.toFixed(2));
    console.log('OPERATIONAL PURCHASES HT:', operationalPurchasesAgg._sum.montantHT?.toFixed(2));
    console.log('OPERATIONAL PURCHASES TTC:', operationalPurchasesAgg._sum.montantTTC?.toFixed(2));
    console.log('DEPENSES (Fixes):', depenseAgg._sum.montant?.toFixed(2));

    const totalCogs = cogsAgg._sum.montantTTC || 0;
    const totalExpenses = (depenseAgg._sum.montant || 0) + (operationalPurchasesAgg._sum.montantTTC || 0);
    const netProfit = totalRevenue - totalCogs - totalExpenses;

    console.log('--- FINAL BENEFICE REAL (ALL TTC) ---');
    console.log('NET PROFIT:', netProfit.toFixed(2));

    await prisma.$disconnect();
}

verifyTTC();
