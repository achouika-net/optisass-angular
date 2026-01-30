
// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    const invoiceNum = 'FA20250744';
    console.log(`🔍 Checking database for invoice ${invoiceNum}...`);

    try {
        const invoice = await prisma.factureFournisseur.findFirst({
            where: { numeroFacture: invoiceNum },
            include: {
                fournisseur: true
            }
        });

        if (!invoice) {
            console.log(`❌ Invoice ${invoiceNum} NOT FOUND in database.`);
            return;
        }

        console.log('✅ Invoice FOUND:', {
            id: invoice.id,
            numero: invoice.numeroFacture,
            statut: invoice.statut,
            montant: invoice.montantTTC,
            fournisseur: invoice.fournisseur?.nom,
            conditionsPaiement: (invoice.fournisseur?.convention as any)?.echeancePaiement?.[0] || invoice.fournisseur?.conditionsPaiement
        });

        // Check Depense table directly by reference
        const depenseRef = `PAY-${invoice.numeroFacture}`;
        console.log(`🔍 Checking for Depense with reference: ${depenseRef}`);

        const depense = await prisma.depense.findFirst({
            where: { reference: depenseRef }
        });

        if (depense) {
            console.log('✅ Automatic Depense FOUND:', {
                id: depense.id,
                montant: depense.montant,
                statut: depense.statut,
                centreId: depense.centreId
            });
        } else {
            console.log(`⚠️ No Automatic Depense found with reference ${depenseRef}`);
        }

    } catch (error) {
        console.error('Error during verification:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
