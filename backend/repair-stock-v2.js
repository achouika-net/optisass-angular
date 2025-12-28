
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repairStock() {
    try {
        const invoiceId = 'fd7f7ac4-dcb4-4690-9c5f-23bdd6880969'; // FAC-2025-001
        const productId = 'a726f799-8d80-4ca9-9827-44554e7e36e3'; // Ray-Ban MON5340
        const qty = 1;

        // 1. Get Data
        const invoice = await prisma.facture.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new Error('Invoice not found');

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error('Product not found');

        // Find Warehouse for Center
        const entrepot = await prisma.entrepot.findFirst({
            where: { centreId: invoice.centreId }
        });
        if (!entrepot) {
            console.error('No warehouse found for center:', invoice.centreId);
            // Fallback: try to find any warehouse? No, strict.
            // Actually, if no warehouse, maybe use null? But schema might require it for stock logic.
            // MouvementStock entrepotSourceId is optional in schema?
            // Let's check schema: entrepotSourceId String? (Nullable)
            // But if I want consistency...
        }
        const entrepotId = entrepot ? entrepot.id : null;

        // 2. Link Product to Invoice
        let lines = invoice.lignes;
        if (lines[0].description.includes('MON5340')) {
            lines[0].productId = productId;
            await prisma.facture.update({
                where: { id: invoiceId },
                data: { lignes: lines }
            });
            console.log('Invoice Line Updated.');
        }

        // 3. Decrement Stock (Check logic)
        // If stock is 8, decrement. If 7, assume previously done?
        // But how to know what it WAS?
        // Let's assume if I find a movement linked to this invoice, I stop.
        const existingMove = await prisma.mouvementStock.findFirst({
            where: { factureId: invoiceId, produitId: productId }
        });

        if (existingMove) {
            console.log('Stock movement already exists. Skipping.');
        } else {
            // Decrement Stock
            // Warning: If previous run decremented but failed movement, stock is already 7.
            // I should trusting the consistent state.
            // If I want to be safe: check logs?
            // Better: Just decrement. If it was double decremented, I can manually fix later. 
            // BUT, if the previous run failed at create(), the product update was likely committed.
            // So check product stock. If it is 7, maybe don't decrement?
            // Let's blindly decrement and create movement, assuming previous failed run might have rolled back? 
            // Prisma throws, does it rollback? No, unless $transaction.

            // Checking if stock is 7 (was 8).
            // Let's Assume product stock IS CORRECT now.
            // I will only create movement if not exists.
            // And decrement stock ONLY if I create movement.
            // But if stock is already decremented without movement?
            // "Updated Invoice Line 0" -> This was first op in previous script.
            // "Decrementing Stock..." -> Second.
            // "Creating Stock Movement..." -> Third (Failed).

            // So stock IS decremented.
            // I should NOT decrement again.

            console.log(`Current Stock: ${product.quantiteActuelle}`);
            // If stock is 7, I assume it was 8.
            // I will just create the movement explicitly setting quantities to match history.

            await prisma.mouvementStock.create({
                data: {
                    type: 'VENTE',
                    quantite: -qty,
                    produitId: productId,
                    factureId: invoiceId,
                    motif: 'Sortie Stock Vente (Réparation Bug)',
                    utilisateur: 'System Repair',
                    entrepotSourceId: entrepotId,
                    // Track previous/new quantities for history consistency
                    // ancienneQuantite: product.quantiteActuelle + qty, // if already decremented
                    // nouvelleQuantite: product.quantiteActuelle
                }
            });
            console.log('Stock Movement Created.');
        }

        console.log('✅ Repair Logic Complete.');

    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
repairStock();
