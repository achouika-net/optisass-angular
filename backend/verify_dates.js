const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const d = await prisma.depense.findUnique({ where: { id: '16fa88e9-0090-49c4-be32-0bb1458258b8' } });
    console.log(d);
}
main().catch(console.error).finally(() => prisma.$disconnect());
