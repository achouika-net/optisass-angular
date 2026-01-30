
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const inv = await prisma.factureFournisseur.findFirst({ where: { numeroFacture: 'FA20250744' } });
    console.log('RESULT:', inv ? 'EXISTS (ID: ' + inv.id + ')' : 'NOT FOUND');
}
run().catch(console.error).finally(() => prisma.$disconnect());
