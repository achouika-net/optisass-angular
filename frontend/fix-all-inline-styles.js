const fs = require('fs');
const path = require('path');

const directoryToScan = 'c:/Users/ASUS/.gemini/antigravity/playground/golden-cluster/frontend/src/app';

const styleMapping = {
    'min-width: 500px; min-height: 200px;': 'min-w-[500px] min-h-[200px]',
    'width: 100%': 'w-full',
    'height: 100%': 'h-full',
    'display: flex': 'flex',
    'display: none': 'hidden',
    'margin-top: 10px': 'mt-2',
    'margin-bottom: 10px': 'mb-2',
    'text-align: center': 'text-center',
    'text-align: right': 'text-right',
    'padding: 24px;': 'p-6',
    'padding: 16px;': 'p-4',
    'padding: 8px;': 'p-2',
    'font-weight: bold;': 'font-bold',
    'font-weight: 600;': 'font-semibold',
    'color: red;': 'text-red-500',
    'color: green;': 'text-green-500',
    'color: #f44336;': 'text-red-500',
    'color: #4caf50;': 'text-green-500',
    'color: #ff9800;': 'text-orange-500',
    'color: #2196f3;': 'text-blue-500',
    'background-color: #f5f5f5;': 'bg-gray-100',
    'background-color: #e0e0e0;': 'bg-gray-200',
    'border-radius: 4px;': 'rounded',
    'border-radius: 8px;': 'rounded-lg',
    'border-radius: 50%;': 'rounded-full',
    'cursor: pointer;': 'cursor-pointer',
    'overflow: hidden;': 'overflow-hidden',
    'position: relative;': 'relative',
    'position: absolute;': 'absolute',
    'z-index: 10;': 'z-10',
    'z-index: 100;': 'z-[100]',
    'flex: 1;': 'flex-1',
    'justify-content: space-between;': 'justify-between',
    'justify-content: center;': 'justify-center',
    'align-items: center;': 'items-center',
    'margin-right: 8px;': 'mr-2',
    'margin-left: 8px;': 'ml-2',
    'margin-top: 16px;': 'mt-4',
    'margin-bottom: 16px;': 'mb-4',
    'font-size: 14px;': 'text-sm',
    'font-size: 12px;': 'text-xs',
    'font-size: 16px;': 'text-base',
    'font-size: 18px;': 'text-lg',
    'font-size: 20px;': 'text-xl',
    'font-size: 24px;': 'text-2xl',
};

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;

    // A more generic regex to capture style attributes
    const styleRegex = /style="([^"]+)"/g;
    
    content = content.replace(styleRegex, (match, styleContent) => {
        hasChanges = true;
        let classesToAdd = [];
        let remainingStyles = [];
        
        const styles = styleContent.split(';').map(s => s.trim()).filter(s => s.length > 0);
        
        styles.forEach(style => {
            const rule = style + ';';
            if (styleMapping[rule]) {
                classesToAdd.push(styleMapping[rule]);
            } else if (styleMapping[style]) {
                classesToAdd.push(styleMapping[style]);
            } else {
                // Try dynamic parsing
                const [prop, val] = style.split(':').map(s => s.trim());
                if (prop === 'max-width') classesToAdd.push(`max-w-[${val}]`);
                else if (prop === 'max-height') classesToAdd.push(`max-h-[${val}]`);
                else if (prop === 'min-width') classesToAdd.push(`min-w-[${val}]`);
                else if (prop === 'min-height') classesToAdd.push(`min-h-[${val}]`);
                else if (prop === 'width') classesToAdd.push(`w-[${val}]`);
                else if (prop === 'height') classesToAdd.push(`h-[${val}]`);
                else if (prop === 'margin') classesToAdd.push(`m-[${val}]`);
                else if (prop === 'margin-top') classesToAdd.push(`mt-[${val}]`);
                else if (prop === 'margin-bottom') classesToAdd.push(`mb-[${val}]`);
                else if (prop === 'margin-left') classesToAdd.push(`ml-[${val}]`);
                else if (prop === 'margin-right') classesToAdd.push(`mr-[${val}]`);
                else if (prop === 'padding') classesToAdd.push(`p-[${val}]`);
                else if (prop === 'padding-top') classesToAdd.push(`pt-[${val}]`);
                else if (prop === 'padding-bottom') classesToAdd.push(`pb-[${val}]`);
                else if (prop === 'padding-left') classesToAdd.push(`pl-[${val}]`);
                else if (prop === 'padding-right') classesToAdd.push(`pr-[${val}]`);
                else if (prop === 'color') classesToAdd.push(`text-[${val}]`);
                else if (prop === 'background-color' || prop === 'background') classesToAdd.push(`bg-[${val}]`);
                else if (prop === 'border-radius') classesToAdd.push(`rounded-[${val}]`);
                else if (prop === 'border') classesToAdd.push(`border-[${val}]`);
                else if (prop === 'font-size') classesToAdd.push(`text-[${val}]`);
                else if (prop === 'flex-direction' && val === 'column') classesToAdd.push('flex-col');
                else if (prop === 'align-items' && val === 'flex-start') classesToAdd.push('items-start');
                else if (prop === 'gap') classesToAdd.push(`gap-[${val}]`);
                else if (prop === 'line-height') classesToAdd.push(`leading-[${val}]`);
                else {
                    remainingStyles.push(style);
                }
            }
        });
        
        let replacement = '';
        if (classesToAdd.length > 0) {
            replacement += `__TAILWIND_CLASSES__="${classesToAdd.join(' ')}"`;
        }
        if (remainingStyles.length > 0) {
            replacement += (replacement ? ' ' : '') + `style="${remainingStyles.join('; ')}"`;
        }
        return replacement || ' '; // Return empty space if all styles were removed
    });

    if (hasChanges) {
        // Merge __TAILWIND_CLASSES__ into existing class attributes
        const classRegex = /class="([^"]*)"\s+__TAILWIND_CLASSES__="([^"]+)"|__TAILWIND_CLASSES__="([^"]+)"\s+class="([^"]*)"/g;
        content = content.replace(classRegex, (match, class1, tailwind1, tailwind2, class2) => {
            const existingClasses = class1 || class2 || '';
            const newClasses = tailwind1 || tailwind2 || '';
            return `class="${existingClasses} ${newClasses}".replace(/\s+/g, ' ').trim()`;
        });
        
        // Handle standalone __TAILWIND_CLASSES__
        content = content.replace(/__TAILWIND_CLASSES__="([^"]+)"/g, 'class="$1"');

        // Fix .replace string output
        content = content.replace(/class="([^"]+)".replace\(\/\\s\+\/g, ' '\)\.trim\(\)/g, 'class="$1"');

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated styles in ${filePath}`);
    }
}

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (fullPath.endsWith('.html')) {
            processHtmlFile(fullPath);
        }
    }
}

scanDirectory(directoryToScan);
console.log('Finished scanning and updating HTML files.');
