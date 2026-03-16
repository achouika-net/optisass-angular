const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log("Starting DB Test");
    
    // Find a random Fiche that has a facture attached
    const facture = await prisma.facture.findFirst({
        where: { ficheId: { not: null } },
        select: { ficheId: true, numero: true, id: true, statut: true }
    });
    
    if (!facture) {
        console.log("No factures with ficheId found.");
        return;
    }
    console.log("Found facture:", facture);
    
    // Try to find it using findAll logic
    const results = await prisma.facture.findMany({
        where: { ficheId: facture.ficheId },
        take: 1
    });
    
    console.log("findMany results length:", results.length);
    if(results.length > 0) {
        console.log("MATCHED ID:", results[0].id);
    }
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
