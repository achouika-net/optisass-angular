import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const fiche = await prisma.fiche.findFirst({
        include: {
            client: true
        }
    });
    console.log(JSON.stringify(fiche, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
