
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repairStock() {
    try {
        const invoiceId = 'fd7f7ac4-dcb4-4690-9c5f-23bdd6880969'; // FAC-2025-001
        const productId = 'a726f799-8d80-4ca9-9827-44554e7e36e3'; // Ray-Ban MON5340
        const qty = 1;

        // 1. Get Invoice Lines
        const invoice = await prisma.facture.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new Error('Invoice not found');

        let lines = invoice.lignes; // JSON
        // Assume first line is the monture (based on description check)
        // Check if line 0 matches MON5340
        if (!lines[0].description.includes('MON5340')) {
            console.error('Line 0 does not match MON5340. Aborting.');
            return;
        }

        console.log('Updating Invoice Line 0...');
        lines[0].productId = productId;

        // 2. Update Invoice
        await prisma.facture.update({
            where: { id: invoiceId },
            data: { lignes: lines }
        });

        // 3. Decrement Product Stock
        console.log('Decrementing Stock...');
        await prisma.product.update({
            where: { id: productId },
            data: { quantiteActuelle: { decrement: qty } }
        });

        // 4. Create Stock Movement
        console.log('Creating Stock Movement...');
        await prisma.mouvementStock.create({
            data: {
                type: 'VENTE',
                quantite: -qty,
                produitId: productId,
                factureId: invoiceId,
                motif: 'Sortie Stock Vente (Réparation Bug)',
                utilisateur: 'System Repair',
                entrepotSourceId: invoice.centreId // Best guess, or find warehouse linked to center
            }
        });

        console.log('✅ Repair Complete. Stock adjusted.');

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
repairStock();
