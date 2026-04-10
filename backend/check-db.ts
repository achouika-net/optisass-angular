import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const group = await prisma.fiche.groupBy({
        by: ['type'],
        _count: { _all: true }
    });
    console.log(group);
}
main().catch(console.error).finally(() => prisma.$disconnect());
