const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const id = '680711ed-5783-448d-8697-de34872bf779';
    const client = await prisma.client.findUnique({
        where: { id }
    });
    console.log(JSON.stringify(client, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
