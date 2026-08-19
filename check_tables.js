const fs = require('fs');
const path = require('path');

function findTables(dir) {
    const results = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results.push(...findTables(fullPath));
        } else if (fullPath.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('<table')) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

const tableFiles = findTables('components');
tableFiles.push(...findTables('app'));

console.log("Files with tables:");
for (const file of tableFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const tableLines = lines.map((l, i) => l.includes('<table') ? i : -1).filter(i => i !== -1);
    
    for (const lineNum of tableLines) {
        // Look at previous 2 lines for overflow-x-auto
        const prev1 = lines[lineNum - 1] || '';
        const prev2 = lines[lineNum - 2] || '';
        const hasOverflow = prev1.includes('overflow-x-auto') || prev2.includes('overflow-x-auto');
        console.log(`- ${file}:${lineNum + 1} | Wrapped: ${hasOverflow}`);
    }
}
