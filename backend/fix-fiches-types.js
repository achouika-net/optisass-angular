const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Restoring and fixing Fiche types...");
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

        // Condition 1: Check for explicit Monture properties
        const hasEquipments = c.equipements && Array.isArray(c.equipements) && c.equipements.length > 0;
        const hasMontureLegacy = c.monture || c.verres || c.ordonnance || c.typeEquipement;
        
        const isMonture = !!(hasEquipments || hasMontureLegacy);

        // Condition 2: Check for strictly Products
        const isProduit = c.produits && Array.isArray(c.produits) && !isMonture && !c.lentilles && !c.lentille && !c.adaptation;

        if (isMonture) {
            determinedType = 'monture';
            countMontureFixed++;
        } else if (isProduit) {
            determinedType = 'produit';
            countProduit++;
        } else {
            // EVERYTHING ELSE (the ~6378 fiches without explicit monture/verre data) are Lentilles
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
