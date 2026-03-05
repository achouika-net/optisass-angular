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
        select: {
            id: true,
            numero: true,
            type: true,
            statut: true,
            fiche: {
                select: {
                    id: true,
                    content: true
                }
            }
        }
    });

    factures.forEach(f => {
        console.log(`Facture ID: ${f.id}`);
        console.log(`Numero: ${f.numero}`);
        console.log(`Type: ${f.type}`);
        console.log(`Fiche Content Sample (first 200 chars): ${JSON.stringify(f.fiche?.content || {}).substring(0, 200)}...`);
        console.log('---');
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
