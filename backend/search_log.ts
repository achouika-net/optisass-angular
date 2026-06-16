import * as fs from 'fs';
import * as readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('c:/Users/ASUS/.gemini/antigravity/playground/golden-cluster/backend/import_execute.log');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log('Searching import_execute.log...');
  let lineCount = 0;
  let matches = 0;
  for await (const line of rl) {
    lineCount++;
    if (line.includes('1400.2') || line.toUpperCase().includes('LCN') || line.toUpperCase().includes('EFFET')) {
      matches++;
      console.log(`Line ${lineCount}: ${line}`);
      if (matches >= 50) {
        console.log('Too many matches, stopping search.');
        break;
      }
    }
  }
  console.log(`Search finished. Checked ${lineCount} lines.`);
}

main().catch(console.error);
