import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = path.join(__dirname, 'dist/features/treasury/treasury.service.js');
  if (!fs.existsSync(filePath)) {
    console.log('dist file does not exist');
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');

  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('inChequeStats') || l.includes('CH\u00C8QUE') || l.includes('CHÈQUE')) {
      console.log(`Line ${idx + 1}: ${l}`);
      const codes = Array.from(l).map(c => c.charCodeAt(0));
      console.log(`  Codes: ${codes.join(', ')}`);
    }
  });
}

main().catch(console.error);
