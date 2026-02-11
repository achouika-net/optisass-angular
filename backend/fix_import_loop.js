const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/features/imports/imports.service.ts');
console.log(`Reading file: ${filePath}`);

let content = fs.readFileSync(filePath, 'utf8');

// Define the START of the block to replace
const startMarker = `                    // Process ALL rows for products and secondary equipments`;
const startMarkerAlt = `                    // Process ALL rows for products and equipments`; // In case I already changed it (unlikely given failures)

// Define the END of the block to replace
// It ends with the closing brace of the loop AND the closing brace of the `rows.forEach`
// The loop ends at line ~791 with `                    });`
// The next line is `                    fichesToCreate.push({`

const endMarker = `                    fichesToCreate.push({`;

const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
    console.error('Could not find start marker!');
    // Try the alt marker just in case
    const startAltIndex = content.indexOf(startMarkerAlt);
    if (startAltIndex !== -1) {
        console.log('Found alternative start marker.');
    } else {
        process.exit(1);
    }
} else {
    console.log(`Found start marker at index ${startIndex}`);
}

const endIndex = content.indexOf(endMarker, startIndex);
if (endIndex === -1) {
    console.error('Could not find end marker!');
    process.exit(1);
}
console.log(`Found end marker at index ${endIndex}`);

// The replacement content
const newLoopLogic = `                    // Process ALL rows for products and equipments
                    const addedProductsRefs = new Set();
                    
                    rows.forEach((row, rowIndex) => {
                        const m: any = {};
                        for (const k of Object.keys(mapping)) if (mapping[k]) m[k] = row[mapping[k]];

                        // Products
                        const addProd = (ref, desc, qte, prix) => {
                            if ((ref || desc) && !addedProductsRefs.has(ref + desc)) {
                                if (!content.produits) content.produits = [];
                                content.produits.push({
                                    reference: String(ref || ''),
                                    designation: String(desc || ''),
                                    quantite: parseNum(qte) || 1,
                                    prixUnitaire: parseNum(prix) || 0,
                                    prixTotal: (parseNum(qte) || 1) * (parseNum(prix) || 0)
                                });
                                addedProductsRefs.add(ref + desc);
                            }
                        };
                        addProd(m.produit_ref, m.produit_designation, m.produit_qte, m.produit_prix);
                        addProd(m.produit2_ref, m.produit2_designation, m.produit2_qte, m.produit2_prix);

                        // --- EQUIPMENT PROCESSING ---

                        // Helper to create equipment object
                        const createEquip = (mtType, mtData, vrData) => ({
                            type: mtType || 'Monture',
                            dateAjout: new Date(),
                            monture: {
                                marque: mtData.marque,
                                modele: mtData.modele,
                                reference: mtData.reference || 'Equipement Extra',
                                prixMonture: parseNum(mtData.prix) || 0
                            },
                            verres: {
                                type: 'Unifocal',
                                marque: vrData.marque,
                                prixOD: parseNum(vrData.prix_od) || 0,
                                prixOG: parseNum(vrData.prix_og) || parseNum(vrData.prix_od) || 0
                            }
                        });

                        // 1. Process PRIMARY columns for SUBSEQUENT rows (rowIndex > 0)
                        if (rowIndex > 0) {
                            // Check if this row has Primary data (Monture/Verres) distinct from the "Header" row
                            // We treat it as a NEW equipment because it's a new row in the group
                            const hasPrimaryData = (m.monture_marque || m.monture_reference || m.verres_marque || m.verres_prix_od);
                            
                            if (hasPrimaryData) {
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
                            if (content.monture && content.monture.prixMonture === 0 && parseNum(m.monture_prix) > 0) {
                                content.monture.prixMonture = parseNum(m.monture_prix);
                            }
                        }

                        // 3. Process SECONDARY columns (For ALL rows, including Row 0)
                        // If monture2 exists, it's ALWAYS a separate equipment.
                        if (m.monture2_marque || m.monture2_reference || m.verres2_marque || m.verres2_prix_od) {
                            
                            // FAILSAFE: Strict check against Main Equipment
                            const matchesMain = (
                                m.monture2_marque === content.monture?.marque && 
                                m.monture2_reference === content.monture?.reference
                            );

                            if (!matchesMain) {
                                content.equipements.push(createEquip('Monture', {
                                    marque: m.monture2_marque,
                                    modele: m.monture2_modele,
                                    reference: m.monture2_reference || 'Equipement 2',
                                    prix: m.monture2_prix
                                }, {
                                    marque: m.verres2_marque,
                                    prix_od: m.verres2_prix_od,
                                    prix_og: m.verres2_prix_og
                                }));
                            } else {
                                // If it matches main, maybe we can steal the price if main is missing it?
                                if (content.monture && content.monture.prixMonture === 0 && m.monture2_prix) {
                                    content.monture.prixMonture = parseNum(m.monture2_prix) || 0;
                                }
                            }
                        }
                    });
`;

// Combine parts
const newContent = content.substring(0, startIndex) + newLoopLogic + '\n' + content.substring(endIndex);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully updated imports.service.ts');
