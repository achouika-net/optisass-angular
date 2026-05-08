import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const requests = await prisma.demandeAlimentation.findMany({
        where: { statut: 'EN_ATTENTE' },
        include: { journeeCaisse: true }
    });

    console.log("Pending Requests:", JSON.stringify(requests, null, 2));

    if (requests.length > 0) {
        const centreId = requests[0].journeeCaisse.centreId;
        const caisses = await prisma.caisse.findMany({
            where: { centreId: centreId }
        });
        console.log("Caisses in center:", JSON.stringify(caisses, null, 2));

        const mainCaisses = caisses.filter(c => ['PRINCIPALE', 'MIXTE'].includes(c.type));
        console.log("Main Caisses:", JSON.stringify(mainCaisses, null, 2));

        for (const c of mainCaisses) {
            const sessions = await prisma.journeeCaisse.findMany({
                where: { caisseId: c.id }
            });
            console.log(`Sessions for Caisse ${c.id}:`, JSON.stringify(sessions, null, 2));
        }
    }
}

main().finally(() => prisma.$disconnect());
