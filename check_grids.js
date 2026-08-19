const fs = require('fs');
const path = require('path');

function findGrids(dir) {
    const results = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results.push(...findGrids(fullPath));
        } else if (fullPath.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('lg:grid-cols-4') || content.includes('lg:grid-cols-3')) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

const gridFiles = findGrids('components');
gridFiles.push(...findGrids('app'));

console.log("Files with lg:grid-cols-3/4:");
for (const file of gridFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const gridLines = lines.map((l, i) => (l.includes('lg:grid-cols-4') || l.includes('lg:grid-cols-3')) ? i : -1).filter(i => i !== -1);
    
    for (const lineNum of gridLines) {
        console.log(`- ${file}:${lineNum + 1} | ${lines[lineNum].trim()}`);
    }
}
