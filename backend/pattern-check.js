const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const badFactures = await prisma.facture.findMany({
        where: {
            numero: { startsWith: 'BC-2026' }
        },
        take: 10,
        include: {
            client: {
                select: { nom: true, prenom: true }
            },
            fiche: {
                select: { content: true }
            }
        }
    });

    badFactures.forEach(f => {
        console.log(`[${f.numero}] Client: ${f.client?.nom} ${f.client?.prenom} | Date: ${f.dateEmission.toISOString()}`);
        console.log(`  Content keys: ${Object.keys(f.fiche?.content || {}).join(', ')}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
