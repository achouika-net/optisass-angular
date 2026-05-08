import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testApprove() {
    const id = "d2b379df-c528-48f6-b95d-e96f23144a76"; // From the user's error

    const request = await prisma.demandeAlimentation.findUnique({
        where: { id },
        include: { journeeCaisse: true }
    });

    if (!request) return console.log("Request not found");
    if (request.statut !== 'EN_ATTENTE') return console.log("Request not pending:", request.statut);

    const centreId = request.journeeCaisse.centreId;
    console.log("Center ID:", centreId);

    const candidateCaisses = await prisma.caisse.findMany({
        where: {
            centreId: centreId,
            type: { in: ['PRINCIPALE', 'MIXTE'] },
            statut: 'ACTIVE',
        },
    });

    console.log("Candidate Caisses:", candidateCaisses);

    const mainCaisse = candidateCaisses.find(c => c.type === 'MIXTE') || candidateCaisses[0];

    if (!mainCaisse) {
        return console.log('Aucune caisse principale active trouvée pour ce centre');
    }

    console.log("Main Caisse Selected:", mainCaisse.id, mainCaisse.type);

    const mainSession = await prisma.journeeCaisse.findFirst({
        where: {
            caisseId: mainCaisse.id,
            statut: 'OUVERTE',
        },
    });

    if (!mainSession) {
        return console.log('La caisse principale doit être ouverte pour approuver une alimentation');
    }

    console.log("Main Session Found:", mainSession.id, mainSession.statut);
    console.log("SUCCESS");
}

testApprove().finally(() => prisma.$disconnect());
