
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLoyaltyConfig() {
    try {
        const configs = await prisma.loyaltyConfig.findMany();
        console.log(`Found ${configs.length} loyalty configurations:`);
        configs.forEach(c => console.log(JSON.stringify(c, null, 2)));

        if (configs.length > 1) {
            console.log('WARNING: Multiple configurations found! This explains why settings revert.');
        }
    } catch (error) {
        console.error('Error fetching configs:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLoyaltyConfig();
