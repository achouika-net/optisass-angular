const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking for Inconsistent Data in Centre ---');
    
    const centers = await prisma.centre.findMany();
    console.log(`Found ${centers.length} centers.`);
    
    for (const center of centers) {
        const group = await prisma.groupe.findUnique({
            where: { id: center.groupeId }
        });
        
        if (!group) {
            console.error(`ERROR: Center "${center.nom}" (ID: ${center.id}) has a groupeId (${center.groupeId}) that does NOT exist in the Groupe table.`);
        } else {
            // console.log(`Center "${center.nom}" is linked to valid group "${group.nom}".`);
        }
    }

    console.log('--- Checking for null groupeId ---');
    const nullGroupCenters = centers.filter(c => !c.groupeId);
    if (nullGroupCenters.length > 0) {
        console.error(`ERROR: Found ${nullGroupCenters.length} centers with NULL groupeId.`);
        nullGroupCenters.forEach(c => console.log(`- ${c.nom} (${c.id})`));
    } else {
        console.log('No centers with NULL groupeId found.');
    }

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
