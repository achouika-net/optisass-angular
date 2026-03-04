import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("--- DB DIAGNOSIS AFTER IMPORT ---");

    const ficheCount = await prisma.fiche.count();
    const factureCount = await prisma.facture.count();

    console.log(`Total Fiches: ${ficheCount}`);
    console.log(`Total Factures: ${factureCount}`);

    if (ficheCount > 0 && factureCount === 0) {
        console.log("Fiches present but Factures are missing. Let's look at Fiche statuses and type.");

        const types = await prisma.fiche.groupBy({
            by: ['type'],
            _count: { type: true }
        });
        console.log("Types of Fiches:", types);

        const recentFiches = await prisma.fiche.findMany({
            orderBy: { dateCreation: 'desc' },
            take: 20
        });
        console.log("Recent Fiches Sample:");
        recentFiches.forEach(f => {
            // Log properties extracted from JSON if they exist to debug logic 
            const hasAmount = f.montantTotal;
            const content: any = typeof f.content === 'object' ? f.content : {};
            console.log(` - Fiche ${f.numero}: type ${f.type}, statut ${f.statut}, Valide (JSON)? ${content?.valide}, Facture (JSON)? ${content?.facture}`);
        });
    } else {
        const recentFactures = await prisma.facture.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        console.log("Factures found:", recentFactures.length, ". Expected roughly: 13000");

        const recentFiches = await prisma.fiche.findMany({
            orderBy: { dateCreation: 'desc' },
            take: 10
        });
        console.log("Looking at top 10 fiches to see their type and if they should be Factures but weren't:");
        recentFiches.forEach(f => {
            const content: any = typeof f.content === 'object' ? f.content : {};
            const isFauxValide = ['faux', 'false', 'non', 'no', '0'].includes(String(content?.valide ?? '').toLowerCase().trim());
            const isValide = !isFauxValide;
            const isFacture = ['vrai', 'true', 'oui', 'yes', '1'].includes(String(content?.facture ?? '').toLowerCase().trim());

            console.log(` - Fiche ${f.numero}: DBtype: ${f.type}, DBstatut: ${f.statut}, JSON[valide]: ${content?.valide}, JSON[facture]: ${content?.facture} -> Code calculated isValide=${isValide}, isFacture=${isFacture}`);
        });

    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
