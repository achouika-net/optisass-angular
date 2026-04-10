const fs = require('fs');
const content = fs.readFileSync('c:/Users/ASUS/.gemini/antigravity/playground/golden-cluster/frontend/src/assets/i18n/fr.json', 'utf8');
const data = JSON.parse(content);

function findDupesInObj(obj, path = '') {
    const seen = new Set();
    const result = [];
    if (typeof obj !== 'object' || obj === null) return result;
    
    // We can't use Object.keys() because it loses duplicates
    // We need to parse the raw string to find keys at the same level
}

// Easier: use a regex to find keys at same indentation level between braces
console.log("Checking line 409 and 446 specifically...");
const lines = content.split('\n');
console.log("409:", lines[408]);
console.log("446:", lines[445]);
