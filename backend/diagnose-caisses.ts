import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const centre = await prisma.centre.findFirst({ where: { nom: 'CENTRE RABAT' } });
    if (!centre) {
        console.log('Centre Rabat not found');
        return;
    }

    const caisses = await prisma.caisse.findMany({
        where: { centreId: centre.id },
        include: {
            journees: {
                where: { statut: 'OUVERTE' }
            }
        }
    });

    console.log(`Caisses in ${centre.nom}:`);
    caisses.forEach(c => {
        console.log(`- ${c.nom} (${c.type}): ${c.journees.length > 0 ? 'OPEN' : 'CLOSED'}`);
        if (c.journees.length > 0) {
            const j = c.journees[0];
            const cash = j.fondInitial + j.totalInterne - j.totalDepenses;
            console.log(`  Fond: ${j.fondInitial}, Interne: ${j.totalInterne}, Depenses: ${j.totalDepenses}`);
            console.log(`  Current Cash: ${cash}`);
        }
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
