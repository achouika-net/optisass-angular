
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.fournisseur.count().then(c => {
    console.log("Total fournisseurs:", c);
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
