require('dotenv').config({ path: '../.env' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Fetch recent lentilles fiches (lowercase)
    const fiches = await prisma.fiche.findMany({
        where: { type: 'lentilles' },
        orderBy: { dateCreation: 'desc' },
        take: 5,
    });

    console.log('Total lentilles fiches found:', fiches.length);

    for (const fiche of fiches) {
        const content = (fiche.content && typeof fiche.content === 'object') ? fiche.content : {};
        console.log('\n=== Fiche ID:', fiche.id, '===');
        console.log('  dateCreation:', fiche.dateCreation);
        console.log('  lentilles exists?', !!content.lentilles);
        if (content.lentilles) {
            console.log('  Full content.lentilles:', JSON.stringify(content.lentilles, null, 2));
        } else {
            console.log('  RAW content sample:', JSON.stringify(content).substring(0, 200));
        }
    }
}

main()
    .catch(e => console.error('Error:', e.message))
    .finally(() => prisma.$disconnect());
