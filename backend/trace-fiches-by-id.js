const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find factures with system numbers first
    const badFactures = await prisma.facture.findMany({
        where: {
            numero: { startsWith: 'BC-2026' }
        },
        select: {
            id: true,
            numero: true,
            ficheId: true
        }
    });

    const ficheIds = badFactures.map(f => f.ficheId).filter(id => id !== null);

    const fiches = await prisma.fiche.findMany({
        where: {
            id: { in: ficheIds }
        },
        select: {
            id: true,
            content: true,
            client: {
                select: { nom: true, prenom: true }
            }
        }
    });

    fiches.forEach(fiche => {
        console.log(`Fiche ID: ${fiche.id} | Client: ${fiche.client?.nom} ${fiche.client?.prenom}`);
        console.log(`Content: ${JSON.stringify(fiche.content)}`);
        console.log('---');
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
