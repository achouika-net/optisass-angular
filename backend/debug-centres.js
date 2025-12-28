
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function listCentres() {
    try {
        const centres = await prisma.centre.findMany();
        console.log('--- CENTRES ---');
        centres.forEach(c => {
            console.log(`[${c.id}] ${c.nom} (${c.ville})`);
        });
    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
listCentres();
