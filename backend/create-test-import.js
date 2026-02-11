
const XLSX = require('xlsx');
const path = require('path');

const data = [
    {
        'Nom': 'DOE John',
        'Tel': '0600000001',
        'Type': 'monture',
        'Sph OD': -2.5,
        'Cyl OD': 0.5,
        'Axe OD': 90,
        'Sph OG': -2.25,
        'Marque Monture': 'Ray-Ban',
        'Modele': 'RB3016',
        'Prix Total': 250,
        'Paye': 100,
        'Notes': 'Test Lunettes'
    },
    {
        'Nom': 'SMITH Jane',
        'Tel': '0600000002',
        'Type': 'lentilles',
        'BC OD': 8.6,
        'Dia OD': 14.2,
        'Sph OD': -3.0,
        'Marque Lentille': 'Acuvue',
        'Usage': 'Mensuelle',
        'Prix Total': 120,
        'Paye': 120,
        'Notes': 'Test Lentilles'
    },
    {
        'Nom': 'BROWN Charlie',
        'Tel': '0600000003',
        'Type': 'accessoires',
        'Ref Produit': 'SOL-123',
        'Designation': 'Solution Multi-usages 360ml',
        'Qte': 2,
        'Prix U': 15,
        'Prix Total': 30,
        'Paye': 30,
        'Notes': 'Test Produit'
    }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Import');

const filePath = path.join(__dirname, 'test-unified-import.xlsx');
XLSX.writeFile(wb, filePath);

console.log(`✅ Test file created at: ${filePath}`);
