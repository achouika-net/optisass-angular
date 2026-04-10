const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Testing prisma.centre.findMany({ include: { groupe: true } }) ---');
    try {
        const centers = await prisma.centre.findMany({
            include: { groupe: true }
        });
        console.log(`Success! Found ${centers.length} centers.`);
    } catch (e) {
        console.error('FAILED with error:');
        console.error(e);
    }
    process.exit(0);
}

main();
