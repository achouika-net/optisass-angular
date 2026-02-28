const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public"
        }
    }
});

async function main() {
    console.log('--- CHECKING PG TRIGGERS ---');
    try {
        const triggers = await prisma.$queryRawUnsafe(`SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';`);
        console.log("Triggers:", triggers);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
