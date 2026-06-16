import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const depenses = await prisma.depense.findMany({
            where: {
                montant: {
                    gte: 1350,
                    lte: 1370
                }
            }
        });
        console.log("DEPENSES:", JSON.stringify(depenses, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
