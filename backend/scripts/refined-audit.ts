
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- REFINED AUDIT: 2136 ISSUE ---');

    const totPayee = await prisma.echeancePaiement.count({ where: { statut: 'PAYEE' } });
    const totAttente = await prisma.echeancePaiement.count({ where: { statut: 'EN_ATTENTE' } });
    const totFactures = await prisma.factureFournisseur.count();
    const totDepenses = await prisma.depense.count();

    console.log(`PAYEE: ${totPayee}`);
    console.log(`EN_ATTENTE: ${totAttente}`);
    console.log(`Total Debts: ${totFactures + totDepenses}`);

    // 1. Extra Invoices Analysis
    const extraFactures = await prisma.factureFournisseur.findMany({
        where: { referenceInterne: { contains: 'AUTO-CREATED' } },
        include: { fournisseur: true }
    });
    console.log(`\nExtra Invoices (${extraFactures.length}):`);
    for (const f of extraFactures) {
        console.log(`- Num: ${f.numeroFacture}, Supplier: ${f.fournisseur.nom}, Created: ${f.createdAt}`);
        // Check if another invoice with same number exists for ANOTHER supplier
        const dupe = await prisma.factureFournisseur.findFirst({
            where: {
                numeroFacture: f.numeroFacture,
                id: { not: f.id }
            },
            include: { fournisseur: true }
        });
        if (dupe) {
            console.log(`  ! Found existing invoice with SAME number but for Supplier: ${dupe.fournisseur.nom}`);
        } else {
            console.log(`  (No duplicate invoice number found in the other 1855)`);
        }
    }

    // 2. Sample EN_ATTENTE Check
    const pendingSample = await prisma.echeancePaiement.findMany({
        where: { statut: 'EN_ATTENTE' },
        include: { factureFournisseur: true },
        take: 5
    });

    console.log('\nSample Unpaid Debts Analysis:');
    for (const p of pendingSample) {
        const num = p.factureFournisseur?.numeroFacture;
        console.log(`Checking pending invoice ${num}`);

        // Look for ANY PAYEE payment for this invoice
        const paidMatches = await prisma.echeancePaiement.findMany({
            where: {
                factureFournisseurId: p.factureFournisseurId,
                statut: 'PAYEE'
            }
        });

        if (paidMatches.length > 0) {
            console.log(`  ! Found ${paidMatches.length} PAYEE records. Import created ADDITIONAL instead of updating.`);
        } else {
            console.log(`  (No PAYEE record found. This debt is legitimately unpaid in the Excel file.)`);
        }
    }
}

main().finally(() => prisma.$disconnect());
