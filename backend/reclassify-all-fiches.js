const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Analyzing all fiches to correctly classify them...");
    const allFiches = await prisma.fiche.findMany({
        select: { id: true, content: true, type: true }
    });

    let countMonture = 0;
    let countLentilles = 0;
    let countProduit = 0;
    let countUnknown = 0;

    const updates = [];

    for (const f of allFiches) {
        const c = f.content || {};
        
        let determinedType = null;

        // Check for Lentilles
        if (c.lentilles || c.lentille || c.adaptation) {
            determinedType = 'lentilles';
        }
        
        // Check for Monture/Verres (usually these are the bulk)
        if (
            (c.equipements && Array.isArray(c.equipements) && c.equipements.length > 0) ||
            c.monture || c.verres || c.ordonnance || c.typeEquipement
        ) {
            // If it has BOTH, usually we consider it a 'monture' type Fiche that also has lentilles (hybrid)
            // or if it's explicitly lentille vs monture. Let's prioritize MONTURE if there are verres.
            determinedType = 'monture'; 
        }

        // Check for strictly Products
        if (c.produits && Array.isArray(c.produits) && !c.ordonnance && !c.lentilles && !c.lentille && !c.equipements) {
            determinedType = 'produit';
        }

        // If still null, fallback to monture
        if (!determinedType) {
            // Attempt deep inspect
            if (Object.keys(c).length === 0) determinedType = 'monture';
            else determinedType = 'monture'; // default fallback historically
            countUnknown++;
        }

        if (determinedType === 'monture') countMonture++;
        if (determinedType === 'lentilles') countLentilles++;
        if (determinedType === 'produit') countProduit++;

        if (f.type !== determinedType) {
            updates.push({ id: f.id, type: determinedType });
        }
    }

    console.log(`Total fiches: ${allFiches.length}`);
    console.log(`- Determined strictly Monture: ${countMonture}`);
    console.log(`- Determined strictly Lentilles: ${countLentilles}`);
    console.log(`- Determined strictly Produit: ${countProduit}`);
    console.log(`- Fallback used: ${countUnknown}`);
    
    // Execute updates
    let processed = 0;
    const batchSize = 1000;
    console.log(`Starting to update ${updates.length} fiches to their correct types...`);
    
    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        await prisma.$transaction(
            batch.map(u => 
                prisma.fiche.update({
                    where: { id: u.id },
                    data: { type: u.type }
                })
            )
        );
        processed += batch.length;
        console.log(`Updated ${processed}/${updates.length} fiches`);
    }
    
    console.log("Re-Classification complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
