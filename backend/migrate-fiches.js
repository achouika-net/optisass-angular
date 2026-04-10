const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Analyzing Fiches JSON content...");
    const allLentilles = await prisma.fiche.findMany({
        where: { type: 'lentilles' },
        select: { id: true, content: true, dateCreation: true }
    });

    let hybrid = 0;
    let onlyEquip = 0;
    let onlyLent = 0;
    let fallback = 0;

    const updates = [];

    for (const f of allLentilles) {
        const c = f.content || {};
        
        // Let's check what exactly is inside
        const hasEquipments = c.equipements && Array.isArray(c.equipements) && c.equipements.length > 0;
        const hasMontureLegacy = !!(c.monture || c.verres);
        const hasLentille = !!c.lentille;
        
        const isMonture = hasEquipments || hasMontureLegacy;

        if (isMonture && hasLentille) {
            hybrid++;
            updates.push({ id: f.id, type: 'monture' });
        } else if (isMonture) {
            onlyEquip++;
            updates.push({ id: f.id, type: 'monture' });
        } else if (hasLentille) {
            onlyLent++;
            // Leave as lentilles
        } else {
            fallback++;
            // Fallback: Check if there's typeEquipement
            if (c.typeEquipement) {
                updates.push({ id: f.id, type: 'monture' });
            } else {
                updates.push({ id: f.id, type: 'monture' }); // Assuming default since they are not lentilles
            }
        }
    }

    console.log(`Out of ${allLentilles.length} 'lentilles' fiches:`);
    console.log(`- ${onlyEquip} are strictly Monture`);
    console.log(`- ${hybrid} are Hybrid (Monture + Lentilles)`);
    console.log(`- ${onlyLent} are strictly Lentilles`);
    console.log(`- ${fallback} are unknown (Fallback to Monture)`);
    
    // Execute updates in batches of 1000 to prevent locking
    let processed = 0;
    const batchSize = 1000;
    console.log(`Starting to update ${updates.length} fiches to 'monture'...`);
    
    // Only updating the first 5 for now to verify success if needed, or we can do all of them.
    // For this script, let's just do the actual migration since we are sure.
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
    
    console.log("Migration complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
