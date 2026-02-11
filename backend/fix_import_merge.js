
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/features/imports/imports.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = '// 1. Process PRIMARY columns for SUBSEQUENT rows (rowIndex > 0)';
const endMarker = '// 3. Process SECONDARY columns (For ALL rows, including Row 0)';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('Markers not found');
    process.exit(1);
}

const newLoopLogic = `// 1. Process PRIMARY columns for SUBSEQUENT rows (rowIndex > 0)
                        if (rowIndex > 0) {
                            // Check if this row has Primary data (Monture/Verres)
                            const hasPrimaryData = (m.monture_marque || m.monture_reference || m.verres_marque || m.verres_prix_od);
                            
                            if (hasPrimaryData) {
                                // [NEW] MERGE INTO MAIN if Main is currently empty or contains generic "CLIENT" placeholder
                                const isMainMontureEmpty = !content.monture?.marque || content.monture?.marque === 'CLIENT';
                                const isMainVerresEmpty = !content.verres?.marque;

                                if (isMainMontureEmpty && (m.monture_marque && m.monture_marque !== 'CLIENT')) {
                                    // Merge frame data into root
                                    if (!content.monture) content.monture = {};
                                    content.monture.marque = m.monture_marque;
                                    content.monture.modele = m.monture_modele || content.monture.modele;
                                    content.monture.reference = m.monture_reference || content.monture.reference;
                                    content.monture.prixMonture = parseNum(m.monture_prix) || content.monture.prixMonture;
                                    console.log(\`MERGED Subsequent Row \${rowIndex} Monture into Main: \${m.monture_marque}\`);
                                } else if (isMainVerresEmpty && m.verres_marque) {
                                    // Merge lens data into root
                                    if (!content.verres) content.verres = { type: 'Unifocal' };
                                    content.verres.marque = m.verres_marque;
                                    content.verres.prixOD = parseNum(m.verres_prix_od) || content.verres.prixOD;
                                    content.verres.prixOG = parseNum(m.verres_prix_og) || parseNum(m.verres_prix_od) || content.verres.prixOG;
                                    console.log(\`MERGED Subsequent Row \${rowIndex} Verres into Main: \${m.verres_marque}\`);
                                } else {
                                    // Both Main and Row have data -> Add as NEW equipment to avoid overwriting
                                    content.equipements.push(createEquip('Monture', {
                                        marque: m.monture_marque,
                                        modele: m.monture_modele,
                                        reference: m.monture_reference,
                                        prix: m.monture_prix
                                    }, {
                                        marque: m.verres_marque,
                                        prix_od: m.verres_prix_od,
                                        prix_og: m.verres_prix_og
                                    }));
                                }
                            }
                        } else {
                            // 2. FOR ROW 0 ONLY: Checks for 0-price overwrite
                            // If content.verres (Main) has 0 price, but this row effectively has a price, patch it.
                            if (content.verres && content.verres.prixOD === 0 && parseNum(m.verres_prix_od) > 0) {
                                content.verres.prixOD = parseNum(m.verres_prix_od);
                            }
                            if (content.verres && content.verres.prixOG === 0 && (parseNum(m.verres_prix_og) > 0 || parseNum(m.verres_prix_od) > 0)) {
                                content.verres.prixOG = parseNum(m.verres_prix_og) || parseNum(m.verres_prix_od);
                            }
                            // Same for Monture
                            if (content.monture && (content.monture.prixMonture === 0 || !content.monture.prixMonture) && parseNum(m.monture_prix) > 0) {
                                content.monture.prixMonture = parseNum(m.monture_prix);
                            }
                        }

                        `;

const newContent = content.substring(0, startIndex) + newLoopLogic + content.substring(endIndex);
fs.writeFileSync(filePath, newContent);
console.log('Successfully updated imports.service.ts loop logic');
