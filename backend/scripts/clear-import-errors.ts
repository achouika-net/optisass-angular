import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

async function clearAll() {
    const envs = ['.env', '.env.host'];
    
    for (const envFile of envs) {
        dotenv.config({ path: path.join(__dirname, '..', envFile), override: true });
        const dbUrl = process.env.DATABASE_URL;
        console.log(`\n🔎 Vérification de l'environnement : ${envFile}`);
        console.log(`🔗 URL : ${dbUrl ? dbUrl.replace(/:[^:@]+@/, ':****@') : 'N/A'}`);

        const prisma = new PrismaClient();
        try {
            const fCount = await prisma.factureFournisseur.count();
            const dCount = await prisma.depense.count();
            const eCount = await prisma.echeancePaiement.count();

            if (fCount > 0 || dCount > 0 || eCount > 0) {
                console.log(`📊 Trouvé : ${fCount} FF, ${dCount} DEP, ${eCount} ECH.`);
                
                // Nuclear delete for these tables
                const d1 = await prisma.depense.deleteMany({});
                const d2 = await prisma.factureFournisseur.deleteMany({});
                const d3 = await prisma.echeancePaiement.deleteMany({});
                
                console.log(`✅ Nettoyé : ${d1.count} DEP, ${d2.count} FF, ${d3.count} ECH supprimés.`);
            } else {
                console.log('✨ Déjà vide.');
            }
        } catch (e) {
            console.log(`❌ Erreur sur cet env : ${e.message}`);
        } finally {
            await prisma.$disconnect();
        }
    }
}

clearAll();
