const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.mouvementStock.findMany({ orderBy: { dateMovement: 'desc' }, take: 10 }).then(console.log).finally(() => { process.exit(0); });
