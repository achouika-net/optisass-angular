
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function findFiche() {
    try {
        const client = await prisma.client.findFirst({
            where: {
                OR: [
                    { nom: { contains: 'Arsalane', mode: 'insensitive' } },
                    { prenom: { contains: 'Arsalane', mode: 'insensitive' } },
                    { raisonSociale: { contains: 'Arsalane', mode: 'insensitive' } }
                ]
            }
        });

        if (!client) {
            console.log('Client not found');
            return;
        }

        const fiche = await prisma.fiche.findFirst({
            where: { clientId: client.id },
            orderBy: { numero: 'desc' }
        });

        if (!fiche) {
            console.log('Fiche not found for client:', client.id);
            return;
        }

        console.log('Found Fiche Content:');
        console.log(JSON.stringify(fiche.content, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

findFiche();
