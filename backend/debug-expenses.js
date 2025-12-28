
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Recent Expenses (Depense) ---');
    const expenses = await prisma.depense.findMany({
        take: 10,
        orderBy: { date: 'desc' },
        include: { echeancePaiement: true } // Relation name often singular or matches model name if not customized
    });

    /*
     Doughnut uses: prisma.depense.groupBy({ by: ['categorie'] })
     This includes ALL expenses regardless of mode.
     
     Card uses:
     1. depense.aggregate({ where: { modePaiement: { in: ['ESPECES', 'CARTE'] } } })
     2. echeancePaiement.aggregate({ where: { ... } })
     
     If Loyer is mode='CHEQUE' and has NO echeance, it is missed by BOTH.
    */

    expenses.forEach(e => {
        console.log(`Expense ID: ${e.id}`);
        console.log(`  Cat: ${e.categorie}, Montant: ${e.montant}, Mode: ${e.modePaiement}, Date: ${e.date}`);
        if (e.echeances && e.echeances.length > 0) {
            console.log(`  -> Has ${e.echeances.length} Echeances.`);
            e.echeances.forEach(ech => console.log(`     - Due: ${ech.dateEcheance}, Status: ${ech.statut}, Amt: ${ech.montant}`));
        } else {
            console.log(`  -> NO Echeances.`);
        }
    });

    console.log('--- Checking EcheancePaiement directly ---');
    const echeances = await prisma.echeancePaiement.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { depense: true }
    });
    echeances.forEach(e => {
        console.log(`Echeance ${e.id} Linked to Depense: ${e.depense?.categorie || 'None'}, Amount: ${e.montant}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
