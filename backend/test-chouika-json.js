const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const client = await prisma.client.findFirst({
        where: { nom: { contains: 'CHOUIKA', mode: 'insensitive' } }
    });

    if (!client) {
        console.log(JSON.stringify({ error: "Client not found." }));
        return;
    }

    const fiches = await prisma.fiche.findMany({
        where: { clientId: client.id },
        orderBy: { createdAt: 'desc' },
        take: 3
    });

    const results = [];
    for (const f of fiches) {
        const factures = await prisma.facture.findMany({
            where: { ficheId: f.id }
        });
        results.push({
            ficheId: f.id,
            type: f.type,
            factures: factures.map(fact => ({ id: fact.id, numero: fact.numero, type: fact.type, statut: fact.statut }))
        });
    }
    console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
