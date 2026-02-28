const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function main() {
    console.log('--- CHECKING DOCKER DB (PORT 5435) COUNT ---');
    try {
        const c1 = await prisma.factureFournisseur.count();
        console.log(`FactureFournisseur count: ${c1}`);
        const c2 = await prisma.depense.count();
        console.log(`Depense count: ${c2}`);
    } catch (error) {
        console.error("Error connecting to database or counting:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
