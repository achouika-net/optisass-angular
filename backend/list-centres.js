const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const centres = await prisma.centre.findMany();
    console.log('Centres available:');
    centres.forEach(c => console.log(`- ID: ${c.id}, Nom: ${c.nom}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
