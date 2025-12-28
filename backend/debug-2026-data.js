
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Invoices and Echeances for 2026 ---');

    // Check Echeances in 2026
    try {
        const echeances = await prisma.echeancePaiement.findMany({
            where: {
                dateEcheance: {
                    gte: new Date('2026-01-01T00:00:00Z'),
                    lte: new Date('2026-12-31T23:59:59Z')
                }
            },
            include: {
                factureFournisseur: true
            }
        });

        console.log(`Found ${echeances.length} echeances in 2026:`);
        echeances.forEach(e => {
            console.log(`- Date: ${e.dateEcheance}, Montant: ${e.montant}, Statut: ${e.statut}, Facture: ${e.factureFournisseur?.numeroFacture}`);
        });
    } catch (e) {
        console.error('Error finding echeances:', e);
    }

    console.log('\n--- Checking All Invoices Created Recently ---');
    try {
        const recentInvoices = await prisma.supplierInvoice.findMany({ // Assuming mapped name, or 'factureFournisseur'
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { echeances: true }
        });

        recentInvoices.forEach(inv => {
            console.log(`Invoice ${inv.numeroFacture} (Total: ${inv.montantTTC}):`);
            console.log(`  Date Emission: ${inv.dateEmission}, Date Echeance (Main): ${inv.dateEcheance}`);
            if (inv.echeances && inv.echeances.length > 0) {
                inv.echeances.forEach(e => {
                    console.log(`    -> Echeance: ${e.dateEcheance}, Amount: ${e.montant}`);
                });
            } else {
                console.log('    -> No Echeances found.');
            }
        });
    } catch (e) {
        console.log('Maybe model name is factureFournisseur? Trying that...');
        try {
            const recentInvoices = await prisma.factureFournisseur.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { echeances: true }
            });

            recentInvoices.forEach(inv => {
                console.log(`Invoice ${inv.numeroFacture} (Total: ${inv.montantTTC}):`);
                console.log(`  Date Emission: ${inv.dateEmission}, Date Echeance (Main): ${inv.dateEcheance}`);
            });
        } catch (e2) {
            console.error('Error finding invoices:', e2);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
