
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function check() {
    const warehouses = await prisma.entrepot.findMany({
        include: { centre: true }
    });

    const products = await prisma.product.findMany({
        where: {
            OR: [
                { codeInterne: 'MON5571' },
                { codeInterne: 'MON1157' }
            ]
        },
        include: {
            entrepot: { include: { centre: true } }
        }
    });

    const data = JSON.stringify({ warehouses, products }, null, 2);
    fs.writeFileSync('warehouse_inventory.json', data);
    console.log('Done writing warehouse_inventory.json');
}

check()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
