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
            fiche: true
        }
    });

    for (const f of factures) {
        console.log(`Facture ID: ${f.id}`);
        console.log(`Numero: ${f.numero}`);
        console.log(`Type: ${f.type}`);
        // Check if the fiche has some legacy fields in content
        if (f.fiche && f.fiche.content) {
            const content = f.fiche.content;
            console.log(`Legacy Num (numero): ${content.numero}`);
            console.log(`Legacy Fiche ID (fiche_id): ${content.fiche_id}`);
            console.log(`Legacy Numero Fiche (numero_fiche): ${content.numero_fiche}`);
        }
        console.log('---');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
