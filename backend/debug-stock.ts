
import { PrismaClient } from '@prisma/client';

async function debugStock() {
    const prisma = new PrismaClient();
    try {
        console.log('--- Deep Stock Debug ---');

        // Let's find all centers first to see what we have
        const centers = await prisma.centre.findMany({
            include: {
                entrepots: {
                    include: {
                        produits: {
                            select: {
                                typeArticle: true,
                                quantiteActuelle: true,
                                prixAchatHT: true,
                                prixVenteHT: true
                            }
                        }
                    }
                }
            }
        });

        centers.forEach(c => {
            console.log(`\nCenter: ${c.nom} (${c.id})`);
            c.entrepots.forEach(w => {
                console.log(`  Warehouse: ${w.nom} (${w.id})`);
                console.log(`    Product count: ${w.produits.length}`);

                let totalValueAchat = 0;
                let totalValueVente = 0;
                let totalQty = 0;

                w.produits.forEach(p => {
                    totalQty += (p.quantiteActuelle || 0);
                    totalValueAchat += (p.quantiteActuelle || 0) * (p.prixAchatHT || 0);
                    totalValueVente += (p.quantiteActuelle || 0) * (p.prixVenteHT || 0);
                });

                console.log(`    Total Quantity: ${totalQty}`);
                console.log(`    Total Value (Achat): ${totalValueAchat}`);
                console.log(`    Total Value (Vente): ${totalValueVente}`);

                if (w.produits.length > 0) {
                    const sample = w.produits.filter(p => p.quantiteActuelle > 0).slice(0, 2);
                    console.log(`    Sample products with qty > 0:`, JSON.stringify(sample, null, 2));
                }
            });
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugStock();
