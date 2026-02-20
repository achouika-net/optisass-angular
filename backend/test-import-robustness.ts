
import { PrismaClient } from '@prisma/client';
import { ImportsService } from './src/features/imports/imports.service';

const prisma = new PrismaClient();
const service = new ImportsService(prisma as any);

async function test() {
    console.log('--- TESTING AUTO-NUMBERING FOR NON-INVOICE LINES ---');

    const mapping = {
        numeroFacture: 'N° Facture',
        nomFournisseur: 'Fournisseur',
        montantTTC: 'Total',
        dateEmission: 'Date'
    };

    const data = [
        { 'N° Facture': 'INV-001', 'Fournisseur': 'Supplier A', 'Total': 100, 'Date': '2023-01-01' },         // Row 1: Valid invoice
        { 'N° Facture': '', 'Fournisseur': 'CNSS', 'Total': 1500, 'Date': '2023-01-05' },                   // Row 2: Non-invoice (Salary/CNSS)
        { 'N° Facture': null, 'Fournisseur': 'Avance Salaire', 'Total': 500, 'Date': '2023-01-10' },        // Row 3: Non-invoice (Salary advance)
        { 'N° Facture': 'N° Facture', 'Fournisseur': 'Fournisseur', 'Total': 'Total', 'Date': 'Date' },     // Row 4: Header noise
        { 'N° Facture': '', 'Fournisseur': '', 'Total': '', 'Date': '' }                                    // Row 5: Empty noise
    ];

    console.log('Executing importFacturesFournisseurs with auto-numbering...');

    try {
        const results = await service.importFacturesFournisseurs(data, mapping, 'test-centre');
        console.log('Results:', JSON.stringify(results, null, 2));

        // Expected: 
        // Row 1: Success/Update
        // Row 2: Success (AUTO-20230105-1500-CNSS)
        // Row 3: Success (AUTO-20230110-500-AVANC)
        // Row 4 & 5: Skipped silently

        console.log(`Success count: ${results.success}`);
        console.log(`Skipped count: ${results.skipped}`);
        console.log(`Errors count: ${results.errors.length}`);

        if (results.success >= 2 && results.skipped >= 2) {
            console.log('✅ TEST PASSED: Non-invoice lines were imported with auto-numbers.');
        } else {
            console.log('❌ TEST FAILED: Auto-numbering or skipping not working as expected.');
        }
    } catch (e) {
        console.error('Test execution failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
