const fs = require('fs');

function patchFile(file) {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    
    // Add counts['FICHES'] if it doesn't exist
    if (!content.includes("counts['FICHES'] = await prisma.fiche.count")) {
        content = content.replace(
            /counts\['CLIENTS'\] = await prisma\.client\.count\(\{ where: \{ centreId: CENTRE_ID \} \}\);/,
            "counts['CLIENTS'] = await prisma.client.count({ where: { centreId: CENTRE_ID } });\n  counts['FICHES'] = await prisma.fiche.count({ where: { client: { centreId: CENTRE_ID } } });"
        );
        fs.writeFileSync(file, content);
        console.log('Patched ' + file);
    }
}

patchFile('backend/clean_casablanca.js');
patchFile('backend/clean_rabat.js');
