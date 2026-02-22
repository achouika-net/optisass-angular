const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Deep Investigation (Feb 2023) ---');

    const startFeb2023 = new Date('2023-02-01T00:00:00Z');
    const endFeb2023 = new Date('2023-02-28T23:59:59Z');

    // 1. Search for ANY MouvementStock in Feb 2023
    const allMvts = await prisma.mouvementStock.findMany({
        where: {
            dateMovement: { gte: startFeb2023, lte: endFeb2023 }
        },
        include: {
            facture: true
        }
    });

    console.log(`Total MouvementStock found in Feb 2023: ${allMvts.length}`);
    if (allMvts.length > 0) {
        const linkedCount = allMvts.filter(m => m.factureId).length;
        console.log(`- Linked to Facture: ${linkedCount}`);
        console.log(`- Unlinked: ${allMvts.length - linkedCount}`);

        const motifs = [...new Set(allMvts.map(m => m.motif))];
        console.log(`- Unique Motifs: ${motifs.join(', ')}`);

        const sampleMvts = allMvts.slice(0, 5);
        console.log('Sample MouvementStock entries:');
        sampleMvts.forEach(m => console.log(`- ${m.id} | Qty: ${m.quantite} | Price: ${m.prixAchatUnitaire} | Motif: ${m.motif} | FactureId: ${m.factureId}`));
    }

    // 2. Search for ANY Depense record in the entire database
    const globalExpenseCount = await prisma.depense.count();
    console.log(`Total Depense records in global DB: ${globalExpenseCount}`);

    if (globalExpenseCount > 0) {
        const sampleExpenses = await prisma.depense.findMany({
            take: 5,
            orderBy: { date: 'desc' }
        });
        console.log('Sample Global Expenses (Latest):');
        sampleExpenses.forEach(e => console.log(`- Date: ${e.date.toISOString()} | Amount: ${e.montant} | Desc: ${e.description}`));
    }

    // 3. Check for specific centreId in Expenses
    const expenseCentres = await prisma.depense.groupBy({
        by: ['centreId'],
        _count: { _all: true }
    });
    console.log('Expenses by CentreId:');
    expenseCentres.forEach(c => console.log(`- CentreId: ${c.centreId} | Count: ${c._count._all}`));

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
