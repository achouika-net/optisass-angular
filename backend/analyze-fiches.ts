import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    // Fiches with equipments
    console.log("Analyzing Fiches JSON content...");
    const allLentilles = await prisma.fiche.findMany({
        where: { type: 'lentilles' },
        select: { id: true, content: true }
    });

    let hybrid = 0;
    let onlyEquip = 0;
    let onlyLent = 0;
    let fallback = 0;

    const updates = [];

    for (const f of allLentilles) {
        const c = f.content as any;
        const hasEquipments = c.equipements && Array.isArray(c.equipements) && c.equipements.length > 0;
        const hasMontureLegacy = c.monture || c.verres;
        const hasLentille = !!c.lentille;
        
        const isMonture = hasEquipments || hasMontureLegacy;

        if (isMonture && hasLentille) {
            hybrid++;
            // Hybrid fiches are handled as MONTURE in the UI model which has 'lentilles?: any'
            updates.push({ id: f.id, type: 'monture' });
        } else if (isMonture) {
            onlyEquip++;
            updates.push({ id: f.id, type: 'monture' });
        } else if (hasLentille) {
            onlyLent++;
            // leave as 'lentilles'
        } else {
            fallback++;
            // unknown, maybe monture
            updates.push({ id: f.id, type: 'monture' });
        }
    }

    console.log(`Out of ${allLentilles.length} 'lentilles' fiches:`);
    console.log(`- ${onlyEquip} are strictly Monture`);
    console.log(`- ${hybrid} are Hybrid (Monture + Lentilles) - will be set to Monture`);
    console.log(`- ${onlyLent} are strictly Lentilles`);
    console.log(`- ${fallback} are unknown (Fallback to Monture)`);
    console.log(`Will update ${updates.length} fiches to 'monture'.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
