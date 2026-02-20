
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Clearing Supplier and Invoice Data ---');

    try {
        // Order of deletion to respect foreign keys:
        // 1. EcheancePaiement (linked to FactureFournisseur)
        // 2. Depense (linked to FactureFournisseur or EcheancePaiement)
        // 3. FactureFournisseur (linked to Fournisseur)
        // 4. Fournisseur

        console.log('Deleting EcheancePaiement...');
        const echeances = await prisma.echeancePaiement.deleteMany({});
        console.log(`Deleted ${echeances.count} installments.`);

        console.log('Deleting Depense...');
        const depenses = await prisma.depense.deleteMany({});
        console.log(`Deleted ${depenses.count} expenses.`);

        console.log('Deleting FactureFournisseur...');
        const factures = await prisma.factureFournisseur.deleteMany({});
        console.log(`Deleted ${factures.count} invoices.`);

        console.log('Deleting Fournisseur...');
        const fournisseurs = await prisma.fournisseur.deleteMany({});
        console.log(`Deleted ${fournisseurs.count} suppliers.`);

        console.log('\n--- Verification ---');
        const countSuppliers = await prisma.fournisseur.count();
        const countInvoices = await prisma.factureFournisseur.count();
        const countExpenses = await prisma.depense.count();
        const countInstallments = await prisma.echeancePaiement.count();

        console.log(`Remaining Suppliers: ${countSuppliers}`);
        console.log(`Remaining Invoices: ${countInvoices}`);
        console.log(`Remaining Expenses: ${countExpenses}`);
        console.log(`Remaining Installments: ${countInstallments}`);

        if (countSuppliers === 0 && countInvoices === 0 && countExpenses === 0 && countInstallments === 0) {
            console.log('\n✅ Cleanup complete and verified.');
        } else {
            console.error('\n❌ Cleanup FAILED: Some data remains.');
        }
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
