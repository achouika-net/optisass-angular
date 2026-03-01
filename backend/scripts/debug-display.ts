import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugDisplayIssue() {
    console.log('=== Investigation de l\'affichage ===\n');

    // 1. Total counts
    const totalInvoices = await prisma.factureFournisseur.count();
    const totalExpenses = await prisma.depense.count();
    const totalEcheances = await prisma.echeancePaiement.count();

    console.log(`📊 Totaux dans la base:`);
    console.log(`   - FactureFournisseur: ${totalInvoices}`);
    console.log(`   - Depense: ${totalExpenses}`);
    console.log(`   - EcheancePaiement: ${totalEcheances}\n`);

    // 2. parentInvoiceId concept removed — all invoices are top-level now
    console.log(`🔗 Factures enfants (exclues): 0 (concept supprimé)`);
    console.log(`📄 Factures principales: ${totalInvoices}\n`);

    // 3. Check echeances linked to invoices vs expenses
    const echeancesWithInvoice = await prisma.echeancePaiement.count({
        where: {
            factureFournisseur: { isNot: null },
            depense: null
        }
    });

    const echeancesWithExpense = await prisma.echeancePaiement.count({
        where: { depense: { isNot: null } }
    });

    console.log(`📅 Échéances:`);
    console.log(`   - Liées aux factures: ${echeancesWithInvoice}`);
    console.log(`   - Liées aux dépenses: ${echeancesWithExpense}\n`);

    // 4. Check expenses without echeances (direct expenses)
    const directExpenses = await prisma.depense.count({
        where: { echeanceId: null }
    });

    const expensesWithEcheance = await prisma.depense.count({
        where: { echeanceId: { not: null } }
    });

    console.log(`💰 Dépenses:`);
    console.log(`   - Directes (sans échéance): ${directExpenses}`);
    console.log(`   - Avec échéance: ${expensesWithEcheance}\n`);

    // 5. Simulate the query with mode filter (like CHEQUE, LCN, etc.)
    console.log(`🔍 Simulation requête avec mode='ALL':`);
    const modeQuery = await prisma.echeancePaiement.findMany({
        where: {
            statut: { not: 'ANNULE' },
            OR: [
                { factureFournisseur: { isNot: null } },
                { depense: { isNot: null } }
            ]
        },
        take: 5000
    });
    console.log(`   Résultats: ${modeQuery.length} échéances\n`);

    // 6. Simulate default query (no mode, grouped by invoice/expense)
    console.log(`🔍 Simulation requête par défaut (sans mode):`);
    const [expenses, invoiceEcheances] = await Promise.all([
        prisma.depense.findMany({
            where: {},
            orderBy: { date: 'desc' },
            take: 5000
        }),
        prisma.echeancePaiement.findMany({
            where: {
                factureFournisseur: { isNot: null },
                depense: null
            },
            orderBy: { dateEcheance: 'desc' },
            take: 5000
        })
    ]);

    console.log(`   Dépenses: ${expenses.length}`);
    console.log(`   Échéances factures: ${invoiceEcheances.length}`);
    console.log(`   TOTAL AFFICHÉ: ${expenses.length + invoiceEcheances.length}\n`);

    // 7. Check if there are date issues
    const recentInvoices = await prisma.factureFournisseur.count({
        where: {
            dateEmission: {
                gte: new Date('2013-01-01')
            }
        }
    });
    console.log(`📅 Factures depuis 2013: ${recentInvoices}`);

    await prisma.$disconnect();
}

debugDisplayIssue().catch(console.error);
