import * as fs from 'fs';
import * as readline from 'readline';

async function main() {
  const fileStream = fs.createReadStream('c:/Users/ASUS/.gemini/antigravity/playground/golden-cluster/backend/server.log');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log('Searching for 1400/LCN in client payment import logs...');
  let lineCount = 0;
  let inSession = false;
  let matchCount = 0;

  for await (const line of rl) {
    lineCount++;
    if (line.includes('Executing importPaiementsClients...')) {
      inSession = true;
    }
    if (line.includes('Paiements clients import completed')) {
      inSession = false;
    }
    if (inSession) {
      if (line.includes('1400') || line.includes('LCN') || line.includes('EFFET')) {
        matchCount++;
        console.log(`[Line ${lineCount}] ${line.substring(0, 150)}`);
      }
    }
  }
  console.log(`Finished. Found ${matchCount} matches.`);
}

main().catch(console.error);
