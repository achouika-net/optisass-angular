const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:mypassword@localhost:5435/optisaas?schema=public'
        }
    }
});

async function main() {
    const triggers = await prisma.$queryRaw`
    SELECT event_object_table, trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers;
  `;
    console.log('TRIGGERS FOUND:');
    console.log(JSON.stringify(triggers, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
