import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Starting defective warehouse consolidation...');

    const centers = await prisma.centre.findMany({
        include: { entrepots: true }
    });

    for (const center of centers) {
        const defectiveWarehouses = center.entrepots.filter(w =>
            w.nom.toLowerCase().includes('défectueux') ||
            w.nom.toLowerCase().includes('defectueux') ||
            w.nom.toUpperCase() === 'DÉFECTUEUX'
        );

        if (defectiveWarehouses.length <= 1) {
            console.log(`✅ Center ${center.nom} has ${defectiveWarehouses.length} defective warehouse(s). No merge needed.`);
            continue;
        }

        console.log(`⚠️ Center ${center.nom} has ${defectiveWarehouses.length} defective warehouses. Merging...`);

        // 1. Pick Canonical (prefer "Entrepot Défectueux" exactly)
        const canonical = defectiveWarehouses.find(w => w.nom === 'Entrepot Défectueux') || defectiveWarehouses[0];
        const others = defectiveWarehouses.filter(w => w.id !== canonical.id);

        console.log(`👉 Canonical: ${canonical.nom} (${canonical.id})`);

        for (const other of others) {
            console.log(`   Merging ${other.nom} (${other.id})...`);

            // A. Move Products
            const products = await prisma.product.findMany({
                where: { entrepotId: other.id }
            });

            for (const product of products) {
                // Check if already in canonical
                const existingInCanonical = await prisma.product.findFirst({
                    where: { codeInterne: product.codeInterne, entrepotId: canonical.id }
                });

                if (existingInCanonical) {
                    console.log(`      Product ${product.codeInterne} already in canonical. Merging quantities...`);
                    // Update canonical quantity
                    await prisma.product.update({
                        where: { id: existingInCanonical.id },
                        data: { quantiteActuelle: { increment: product.quantiteActuelle } }
                    });

                    // Update movements related to this specific product instance to the canonical one
                    await prisma.mouvementStock.updateMany({
                        where: { produitId: product.id },
                        data: { produitId: existingInCanonical.id }
                    });

                    // Delete the duplicate product
                    await prisma.product.delete({ where: { id: product.id } });
                } else {
                    console.log(`      Moving product ${product.codeInterne} to canonical...`);
                    // Just move it
                    await prisma.product.update({
                        where: { id: product.id },
                        data: { entrepotId: canonical.id }
                    });
                }
            }

            // B. Update Movements strictly pointing to this warehouse ID (even if product was moved)
            await prisma.mouvementStock.updateMany({
                where: { entrepotSourceId: other.id },
                data: { entrepotSourceId: canonical.id }
            });

            await prisma.mouvementStock.updateMany({
                where: { entrepotDestinationId: other.id },
                data: { entrepotDestinationId: canonical.id }
            });

            // C. Delete the redundant warehouse
            await prisma.entrepot.delete({
                where: { id: other.id }
            });

            console.log(`   ✅ Deleted redundant warehouse ${other.nom}`);
        }
    }

    console.log('✨ Consolidation finished successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Consolidation failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
