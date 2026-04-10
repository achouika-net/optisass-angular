const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Restoring actual Lentilles Fiches...");
    const allFiches = await prisma.fiche.findMany({
        select: { id: true, content: true, type: true }
    });

    let countMontureFixed = 0;
    let countLentillesRestored = 0;
    let countProduit = 0;

    const updates = [];

    for (const f of allFiches) {
        const c = f.content || {};
        
        let determinedType = null;

        // Condition 1: Check for strictly Products
        if (c.produits && Array.isArray(c.produits) && !c.ordonnance && !c.lentilles && !c.lentille && !c.equipements && !c.monture && !c.verres) {
            determinedType = 'produit';
            countProduit++;
        }
        // Condition 2: Explicit Monture triggers
        else if (c.monture || c.verres || (c.equipements && Array.isArray(c.equipements) && c.equipements.length > 0)) {
            determinedType = 'monture';
            countMontureFixed++;
        }
        // Condition 3: EVERYTHING ELSE is Lentilles (since 'ordonnance' exists on all 13k docs from import)
        else {
            determinedType = 'lentilles';
            countLentillesRestored++;
        }

        if (f.type !== determinedType) {
            updates.push({ id: f.id, type: determinedType });
        }
    }

    console.log(`- Fiches identifiées comme Monture (M): ${countMontureFixed}`);
    console.log(`- Fiches restaurées comme Lentilles (L): ${countLentillesRestored}`);
    console.log(`- Fiches identifiées comme Produit (P): ${countProduit}`);
    
    // Execute updates
    let processed = 0;
    const batchSize = 1000;
    console.log(`Mise à jour de ${updates.length} fiches...`);
    
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
    
    console.log("Restauration complète.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
