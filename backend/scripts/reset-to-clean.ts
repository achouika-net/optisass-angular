
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- RESET TO CLEAN STATE (1877 DEBTS) ---');

    // 1. Delete invoices created by recent failed attempts
    const deletedInvoices = await prisma.factureFournisseur.deleteMany({
        where: {
            referenceInterne: { contains: 'AUTO-CREATED' }
        }
    });
    console.log(`Deleted ${deletedInvoices.count} auto-created invoices.`);

    // 2. Delete standalone expenses created during recent failed attempts
    const deletedExpenses = await prisma.depense.deleteMany({
        where: {
            description: { contains: 'Paiement sans facture' }
        }
    });
    console.log(`Deleted ${deletedExpenses.count} auto-created expenses.`);

    // 3. Final alignment check
    const invoices = await prisma.factureFournisseur.count();
    const expenses = await prisma.depense.count();
    const echeances = await prisma.echeancePaiement.count();

    console.log('--- FINAL STATE ---');
    console.log(`Factures: ${invoices}`);
    console.log(`Depenses: ${expenses}`);
    console.log(`Total Debts: ${invoices + expenses}`);
    console.log(`Total Echeances: ${echeances}`);

    if ((invoices + expenses) === 1877 && echeances === 1877) {
        console.log('>>> SYSTEM READY FOR 1935 IMPORT <<<');
    } else {
        console.log('>>> ATTENTION: Still misaligned, manual check needed <<<');
    }
}

main();
