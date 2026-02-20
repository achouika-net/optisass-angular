
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('📊 Verifying database counts...');
        const clients = await prisma.client.count();
        const fiches = await prisma.fiche.count();
        const factures = await prisma.facture.count();
        const paiements = await prisma.paiement.count();
        const centres = await prisma.centre.count();
        const employees = await prisma.employee.count();
        const caisses = await prisma.caisse.count();

        console.log(`- Clients: ${clients}`);
        console.log(`- Fiches: ${fiches}`);
        console.log(`- Factures: ${factures}`);
        console.log(`- Paiements: ${paiements}`);
        console.log(`- Centres: ${centres}`);
        console.log(`- Employees: ${employees}`);
        console.log(`- Caisses: ${caisses}`);

        if (clients === 0 && fiches === 0 && factures === 0 && paiements === 0) {
            console.log('✅ CLEANUP VERIFIED: Essential tables are empty.');
        } else {
            console.log('⚠️ WARNING: Some tables still contain data.');
        }
    } catch (e) {
        console.error('Check failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
