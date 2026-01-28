const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list() {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, nom: true, prenom: true }
        });
        console.log('👥 Current Users:', JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('❌ Error listing users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

list();
