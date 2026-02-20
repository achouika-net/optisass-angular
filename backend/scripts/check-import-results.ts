import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkImportResults() {
    console.log('📊 Checking import results...\n');

    try {
        // Count supplier invoices
        const invoiceCount = await prisma.factureFournisseur.count();
        console.log(`✅ Total Factures Fournisseurs: ${invoiceCount}`);

        // Count expenses
        const expenseCount = await prisma.depense.count();
        console.log(`✅ Total Dépenses: ${expenseCount}`);

        // Count payment schedules
        const paymentCount = await prisma.echeancePaiement.count({
            where: {
                factureFournisseur: {
                    isNot: null
                }
            }
        });
        console.log(`✅ Total Paiements (Échéances): ${paymentCount}\n`);

        // Sample invoices
        console.log('📋 Sample Factures Fournisseurs (first 5):');
        const sampleInvoices = await prisma.factureFournisseur.findMany({
            take: 5,
            include: {
                fournisseur: true
            },
            orderBy: {
                dateEmission: 'desc'
            }
        });
        sampleInvoices.forEach(inv => {
            console.log(`  - ${inv.numeroFacture} | ${inv.fournisseur.nom} | ${inv.montantTTC} DH | ${inv.dateEmission.toISOString().split('T')[0]}`);
        });

        // Sample expenses
        console.log('\n💰 Sample Dépenses (first 5):');
        const sampleExpenses = await prisma.depense.findMany({
            take: 5,
            orderBy: {
                date: 'desc'
            }
        });
        sampleExpenses.forEach(exp => {
            console.log(`  - ${exp.description} | ${exp.categorie} | ${exp.montant} DH | ${exp.date.toISOString().split('T')[0]}`);
        });

        // Check payment schedules
        console.log('\n💳 Sample Paiements (first 5):');
        const samplePayments = await prisma.echeancePaiement.findMany({
            take: 5,
            where: {
                factureFournisseur: {
                    isNot: null
                }
            },
            include: {
                factureFournisseur: {
                    include: {
                        fournisseur: true
                    }
                }
            },
            orderBy: {
                dateEcheance: 'desc'
            }
        });
        samplePayments.forEach(pay => {
            console.log(`  - ${pay.factureFournisseur?.numeroFacture} | ${pay.factureFournisseur?.fournisseur.nom} | ${pay.montant} DH | ${pay.dateEcheance.toISOString().split('T')[0]}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkImportResults();
