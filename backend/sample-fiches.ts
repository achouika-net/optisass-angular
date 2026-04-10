import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const fiches = await prisma.fiche.findMany({
        where: { type: 'lentilles' },
        take: 10,
        select: { id: true, type: true, content: true }
    });
    console.log(JSON.stringify(fiches, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
