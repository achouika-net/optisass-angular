const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/features/finance/pages/finance-dashboard/finance-dashboard.component.html');
let content = fs.readFileSync(filePath, 'utf8');

const chequeRegex = /(<div class="flex justify-between px-4" \*ngIf="summary\.incomingCheque > 0">[\s\S]*?<\/div>)/;

const lcnInsert = `
                    <div class="flex justify-between px-4" *ngIf="summary.incomingLCN > 0">
                        <span>Effet LCN:</span>
                        <span class="text-indigo-600 font-medium">
                            {{ summary.incomingLCN | number:'1.2-2' }} DH
                        </span>
                    </div>`;

if (chequeRegex.test(content)) {
  console.log('Found incomingCheque div block in HTML');
  content = content.replace(chequeRegex, `$1${lcnInsert}`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('finance-dashboard.component.html updated successfully');
} else {
  console.log('Could NOT find incomingCheque div block in HTML');
}
