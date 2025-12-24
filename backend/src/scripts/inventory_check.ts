
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    console.log('Checking ALL MON1157 products...');
    const products = await prisma.product.findMany({
        where: {
            codeInterne: 'MON1157'
        },
        include: {
            entrepot: {
                include: {
                    centre: true
                }
            }
        }
    });

    const results = products.map(p => {
        let sd: any = p.specificData;
        if (typeof sd === 'string') try { sd = JSON.parse(sd); } catch (e) { }
        return {
            id: p.id,
            centre: p.entrepot?.centre?.nom,
            entrepot: p.entrepot?.nom,
            stock: p.quantiteActuelle,
            pendingOutgoing: sd?.pendingOutgoing,
            pendingIncoming: sd?.pendingIncoming
        };
    });

    console.log('JSON_START');
    console.log(JSON.stringify(results, null, 2));
    console.log('JSON_END');
}

check()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
