
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const fiche = await prisma.fiche.findFirst({
        orderBy: { dateCreation: 'desc' } // Get the most recently created one
    });

    if (!fiche) {
        console.log('No fiche found');
        return;
    }

    console.log('--- LATEST FICHE (Updated) ---');
    console.log('ID:', fiche.id);
    const content: any = fiche.content;
    console.log('VERRES OBJECT:', JSON.stringify(content.verres, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
