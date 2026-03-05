const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const factures = await prisma.facture.findMany({
        where: {
            client: {
                nom: 'CHAFIAI',
                prenom: 'NADIA'
            }
        },
        include: {
            fiche: {
                select: {
                    id: true,
                    content: true
                }
            }
        }
    });
    console.log(JSON.stringify(factures, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
