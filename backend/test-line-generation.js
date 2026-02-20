
// Mock of the logic inside imports.service.ts
function generateLines(content, totalAmount) {
    const lines = [];
    const addLine = (desc, qte, price) => {
        if (price > 0 || desc) {
            lines.push({
                description: desc || 'Article',
                qte: qte || 1,
                prixUnitaireTTC: price || 0,
                remise: 0,
                totalTTC: (qte || 1) * (price || 0)
            });
        }
    };

    // 1. Monture
    if (content.monture && content.monture.marque) {
        const desc = `Monture ${content.monture.marque} ${content.monture.reference || ''}`.trim();
        addLine(desc, 1, content.monture.prixMonture);
    }

    // 2. Verres
    if (content.verres) {
        const prixVerres = (content.verres.prixOD || 0) + (content.verres.prixOG || 0);
        // Relax condition: even if price is 0, if marque exists, add it
        if (prixVerres > 0 || content.verres.marque) {
            const desc = `Verres ${content.verres.type} ${content.verres.marque || ''}`.trim();
            addLine(desc, 1, prixVerres);
        }
    }

    // 3. Lentilles
    if (content.lentilles) {
        const prixLentilles = (content.lentilles.od?.prix || 0) + (content.lentilles.og?.prix || 0);
        if (prixLentilles > 0 || content.lentilles.od?.marque || content.lentilles.og?.marque) {
            addLine('Lentilles de contact', 1, prixLentilles);
        }
    }

    // 4. Produits
    if (content.produits && Array.isArray(content.produits)) {
        content.produits.forEach((p) => {
            addLine(p.designation, p.quantite, p.prixUnitaire);
        });
    }

    // 5. Autres Equipements
    if (content.equipements && Array.isArray(content.equipements)) {
        content.equipements.forEach((eq, idx) => {
            if (eq.monture) {
                const desc = `Equipement ${idx + 2} - Monture ${eq.monture.marque || ''}`.trim();
                addLine(desc, 1, eq.monture.prixMonture);
            }
            if (eq.verres) {
                const prixV = (eq.verres.prixOD || 0) + (eq.verres.prixOG || 0);
                const desc = `Equipement ${idx + 2} - Verres ${eq.verres.marque || ''}`.trim();
                addLine(desc, 1, prixV);
            }
        });
    }

    // Fallback
    const currentTotal = lines.reduce((acc, l) => acc + l.totalTTC, 0);
    if (lines.length === 0 && totalAmount > 0) {
        addLine('Import Global - Détail manquant', 1, totalAmount);
    }

    return lines;
}

// TEST CASES
const cases = [
    {
        name: "Monture + Verres Classique",
        total: 2000,
        content: {
            monture: { marque: "RayBan", prixMonture: 1000 },
            verres: { prixOD: 500, prixOG: 500, type: "Unifocal" }
        }
    },
    {
        name: "Lentilles Seulement",
        total: 500,
        content: {
            lentilles: { od: { prix: 250 }, og: { prix: 250 } }
        }
    },
    {
        name: "Equipement Vide mais Total > 0 (Fallback)",
        total: 1500,
        content: {}
    },
    {
        name: "Produits Accessoires",
        total: 100,
        content: {
            produits: [{ designation: "Spray", quantite: 2, prixUnitaire: 50 }]
        }
    }
];

cases.forEach(c => {
    console.log(`\n--- TEST: ${c.name} ---`);
    const result = generateLines(c.content, c.total);
    console.log(JSON.stringify(result, null, 2));
    if (result.length === 0 && c.total > 0) console.error("❌ FAILED: Should have generated lines!");
    else console.log(`✅ Generated ${result.length} lines.`);
});
