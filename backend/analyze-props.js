const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Analyzing actual JSON strictly...");
    const allFiches = await prisma.fiche.findMany({
        select: { id: true, content: true }
    });

    let withEquipements = 0;
    let withMontureObj = 0;
    let withVerresObj = 0;
    let withOrdonnance = 0;

    for (const f of allFiches) {
        const c = f.content || {};
        if (c.equipements && Array.isArray(c.equipements) && c.equipements.length > 0) withEquipements++;
        if (c.monture) withMontureObj++;
        if (c.verres) withVerresObj++;
        if (c.ordonnance) withOrdonnance++;
    }

    console.log(`- with equipements array: ${withEquipements}`);
    console.log(`- with monture property: ${withMontureObj}`);
    console.log(`- with verres property: ${withVerresObj}`);
    console.log(`- with ordonnance property: ${withOrdonnance}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
