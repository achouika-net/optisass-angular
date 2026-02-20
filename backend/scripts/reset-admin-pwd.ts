
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    try {
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.update({
            where: { email: 'admin@optisass.com' },
            data: { password: hashedPassword }
        });

        console.log(`✅ Password reset for ${user.email} to: ${password}`);
    } catch (e) {
        console.error('Password reset failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
