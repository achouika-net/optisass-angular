const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Investigating COGS and Expenses (Feb 2023) ---');

    const startFeb2023 = new Date('2023-02-01T00:00:00Z');
    const endFeb2023 = new Date('2023-02-28T23:59:59Z');
    const ACTIVE_STATUSES = ['VALIDE', 'VALIDEE', 'PAYEE', 'SOLDEE', 'ENCAISSE', 'PARTIEL'];

    // 1. Check Invoices with MouvementStock
    const invoicesWithStock = await prisma.facture.findMany({
        where: {
            dateEmission: { gte: startFeb2023, lte: endFeb2023 },
            OR: [
                {
                    OR: [{ type: 'FACTURE' }, { type: 'BON_COMMANDE' }],
                    statut: { in: ACTIVE_STATUSES }
                },
                { type: 'AVOIR' }
            ]
        },
        include: {
            mouvementsStock: true
        }
    });

    console.log(`Matching Invoices found: ${invoicesWithStock.length}`);

    let totalMvtCount = 0;
    let mvtWithPriceCount = 0;
    let totalCogsValue = 0;

    invoicesWithStock.forEach(inv => {
        totalMvtCount += inv.mouvementsStock.length;
        inv.mouvementsStock.forEach(m => {
            if (m.prixAchatUnitaire > 0) mvtWithPriceCount++;
            totalCogsValue += (m.quantite * (m.prixAchatUnitaire || 0));
        });
    });

    console.log(`Total MouvementStock records linked: ${totalMvtCount}`);
    console.log(`Mouvements with prixAchatUnitaire > 0: ${mvtWithPriceCount}`);
    console.log(`Calculated RAW COGS value (should be negative): ${totalCogsValue}`);

    // 2. Check Expenses
    const expenses = await prisma.depense.findMany({
        where: {
            date: { gte: startFeb2023, lte: endFeb2023 }
        }
    });

    console.log(`Expenses found for Feb 2023: ${expenses.length}`);
    const totalExp = expenses.reduce((sum, e) => sum + (e.montant || 0), 0);
    console.log(`Total Expenses Value: ${totalExp}`);

    if (expenses.length > 0) {
        console.log('Sample Expenses:');
        expenses.slice(0, 5).forEach(e => console.log(`- ${e.description || e.categorie}: ${e.montant}`));
    }

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
