import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const [factures, depenses, echeances, fournisseurs] = await Promise.all([
        prisma.factureFournisseur.count(),
        prisma.depense.count(),
        prisma.echeancePaiement.count(),
        prisma.fournisseur.count()
    ]);

    console.log('--- Current Counts ---');
    console.log('FactureFournisseur:', factures);
    console.log('Depense:', depenses);
    console.log('EcheancePaiement:', echeances);
    console.log('Fournisseur:', fournisseurs);

    // Check how many debts are still unpaid or partially paid
    const unpaidFactures = await prisma.factureFournisseur.count({
        where: { statut: { in: ['A_PAYER', 'PARTIELLE'] } }
    });
    const unpaidDepenses = await prisma.depense.count({
        where: { statut: { in: ['A_PAYER', 'PARTIELLE', 'EN_ATTENTE'] } }
    });

    console.log('\n--- Unpaid Debts ---');
    console.log('Unpaid/Partial Invoices:', unpaidFactures);
    console.log('Unpaid/Partial Expenses:', unpaidDepenses);

    // Check if any "FOURNISSEUR INCONNU" exists
    const unknownFournisseurs = await prisma.fournisseur.findMany({
        where: { nom: { contains: 'INCONNU', mode: 'insensitive' } }
    });
    console.log('\n--- Unknown Suppliers Found ---');
    unknownFournisseurs.forEach(f => console.log(`- ${f.nom} (ID: ${f.id})`));

    // Check for some problematic suppliers mentioned in screenshot
    const suppliersToCheck = ['TEST', 'TOP LENS', 'MULTILENS'];
    const specificSuppliers = await prisma.fournisseur.findMany({
        where: { nom: { in: suppliersToCheck, mode: 'insensitive' } }
    });
    console.log('\n--- Target Supplier Checks ---');
    specificSuppliers.forEach(f => console.log(`- Found: ${f.nom}`));

    process.exit(0);
}

main();
