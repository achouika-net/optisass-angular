const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const fiches = await prisma.fiche.findMany({
        where: {
            factures: {
                some: {
                    numero: { startsWith: 'BC-2026' }
                }
            }
        },
        select: {
            id: true,
            content: true,
            client: {
                select: {
                    nom: true,
                    prenom: true
                }
            },
            factures: true
        }
    });

    fiches.forEach(fiche => {
        console.log(`Fiche ID: ${fiche.id} | Client: ${fiche.client?.nom} ${fiche.client?.prenom}`);
        console.log(`Factures: ${fiche.factures.map(f => f.numero).join(', ')}`);
        // Print ALL keys in content to see if we missed something
        console.log(`Content Keys: ${Object.keys(fiche.content || {}).join(', ')}`);
        console.log('---');
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
