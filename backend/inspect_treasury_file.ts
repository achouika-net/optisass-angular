import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = path.join(__dirname, 'src/features/treasury/treasury.service.ts');
  const content = fs.readFileSync(filePath, 'utf8');

  // Find line with "inChequeStats"
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('inChequeStats') || l.includes('CHÈQUE')) {
      console.log(`Line ${idx + 1}: ${l}`);
      // Print character codes on this line
      const codes = Array.from(l).map(c => c.charCodeAt(0));
      console.log(`  Codes: ${codes.join(', ')}`);
    }
  });
}

main().catch(console.error);
