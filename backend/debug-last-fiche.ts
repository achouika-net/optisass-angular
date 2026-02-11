const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const lastFiche = await prisma.fiche.findFirst({
            orderBy: { numero: 'desc' },
        });

        if (lastFiche) {
            console.log('Last Fiche ID:', lastFiche.id);
            console.log('Content:', JSON.stringify(lastFiche.content, null, 2));
        } else {
            console.log('No fiches found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
