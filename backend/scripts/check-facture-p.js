const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const f = await prisma.facture.findUnique({
        where: { id: '4358c203-0a1f-4e66-bb9c-9738c174a14c' },
        include: { paiements: true }
    });
    console.log(JSON.stringify(f, null, 2));
    await prisma.$disconnect();
}

run();
