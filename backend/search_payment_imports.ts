import * as fs from 'fs';
import * as readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('c:/Users/ASUS/.gemini/antigravity/playground/golden-cluster/backend/server.log');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log('Searching server.log for payment import details...');
  let lineCount = 0;
  let matches = 0;
  let inPaymentImport = false;
  let currentSessionLines: string[] = [];

  for await (const line of rl) {
    lineCount++;
    if (line.includes('Executing importPaiementsClients...')) {
      inPaymentImport = true;
      currentSessionLines = [];
      console.log(`=== Start Payment Import at Line ${lineCount} ===`);
    }

    if (inPaymentImport) {
      currentSessionLines.push(line);
      if (line.includes('Paiements clients import completed') || line.includes('completed successfully') || currentSessionLines.length > 200) {
        inPaymentImport = false;
        // Print the lines if they contain 1400 or errors
        const has1400 = currentSessionLines.some(l => l.includes('1400'));
        const hasError = currentSessionLines.some(l => l.toLowerCase().includes('error') || l.toLowerCase().includes('skip') || l.toLowerCase().includes('fail'));
        
        console.log(`Import session lines: ${currentSessionLines.length}`);
        currentSessionLines.forEach((l, idx) => {
          if (l.includes('1400') || l.toLowerCase().includes('error') || l.toLowerCase().includes('skip') || l.toLowerCase().includes('fail') || idx < 10 || idx > currentSessionLines.length - 10) {
            console.log(`  [Line ${lineCount - currentSessionLines.length + idx + 1}] ${l}`);
          }
        });
      }
    }
  }
  console.log('Search finished.');
}

main().catch(console.error);
