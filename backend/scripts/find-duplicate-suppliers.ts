
import { PrismaClient } from '@prisma/client';
import * as levenshtein from 'fast-levenshtein';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Searching for potential duplicate suppliers...');

    const suppliers = await prisma.fournisseur.findMany({
        select: { id: true, nom: true }
    });

    const duplicates: { s1: string, s2: string, distance: number }[] = [];

    for (let i = 0; i < suppliers.length; i++) {
        for (let j = i + 1; j < suppliers.length; j++) {
            const name1 = suppliers[i].nom.toLowerCase().trim();
            const name2 = suppliers[j].nom.toLowerCase().trim();

            // Check for exact match after normalization
            if (name1 === name2) {
                duplicates.push({ s1: suppliers[i].nom, s2: suppliers[j].nom, distance: 0 });
                continue;
            }

            // Fuzzy check
            const distance = levenshtein.get(name1, name2);
            const maxLength = Math.max(name1.length, name2.length);

            // If the difference is small (less than 20% of the name length or max 2 chars)
            if (distance <= 2 || (distance / maxLength) < 0.2) {
                duplicates.push({ s1: suppliers[i].nom, s2: suppliers[j].nom, distance });
            }
        }
    }

    if (duplicates.length === 0) {
        console.log('✅ No obvious duplicates found among ' + suppliers.length + ' suppliers.');
    } else {
        console.log('⚠️ Found ' + duplicates.length + ' potential duplicates:');
        duplicates.forEach(d => {
            console.log(` - "${d.s1}" <-> "${d.s2}" (Diff: ${d.distance})`);
        });
        console.log('\n💡 You can use these names to consolidate your Excel file or I can build a merge script.');
    }

    await prisma.$disconnect();
}

main();
