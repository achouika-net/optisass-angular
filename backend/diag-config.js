const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const config = await prisma.marketingConfig.findFirst();
    console.log('--- Marketing Config ---');
    console.log(JSON.stringify(config, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
