const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function reset() {
    try {
        const hash = await bcrypt.hash('admin123', 10);
        const result = await prisma.user.updateMany({
            where: { email: { in: ['achouika@gmail.com', 'sdfgdf@sdgr.sdg'] } },
            data: { password: hash }
        });
        console.log('✅ Success: Password reset to admin123 for achouika@gmail.com and sdfgdf@sdgr.sdg');
        console.log('Result:', result);
    } catch (error) {
        console.error('❌ Error during reset:', error);
    } finally {
        await prisma.$disconnect();
    }
}

reset();
