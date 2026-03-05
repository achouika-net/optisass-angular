const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const fiches = await prisma.fiche.findMany({
        where: {
            factures: {
                some: {
                    numero: 'BC-2026-008'
                }
            }
        },
        take: 1,
        include: {
            factures: true
        }
    });
    console.log(JSON.stringify(fiches, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
