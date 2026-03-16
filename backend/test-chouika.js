const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Searching for client CHOUIKA Arsalane...");
    const client = await prisma.client.findFirst({
        where: { nom: { contains: 'CHOUIKA', mode: 'insensitive' } }
    });

    if (!client) {
        console.log("Client not found.");
        return;
    }
    console.log("Found client:", client.id, client.nom, client.prenom);

    const fiches = await prisma.fiche.findMany({
        where: { clientId: client.id }
    });
    console.log(`Found ${fiches.length} fiches for client.`);

    for (const f of fiches) {
        console.log(`\nFiche: ${f.id} | Type: ${f.type}`);
        const factures = await prisma.facture.findMany({
            where: { ficheId: f.id }
        });
        console.log(`  -> Factures attached to this fiche: ${factures.length}`);
        for (const fact of factures) {
            console.log(`     - Facture ID: ${fact.id} | Numero: ${fact.numero} | Type: ${fact.type} | Statut: ${fact.statut}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
