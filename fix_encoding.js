const fs = require('fs');
const path = require('path');

const dir = 'components/dashboard/payroll';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace ?{ with {
  content = content.replace(/\?\{/g, '{');
  // Replace the ,1{ or similar broken encoding
  // The character might be multi-byte, so let's match any non-ascii character followed by {
  // Wait, let's just match any character like \uFFFD,1{ or â,¹{
  // Better yet, just match everything between > and { preview...
  
  content = content.replace(/>[^\x00-\x7F]*\{([^}]+)\.toLocaleString\(\)\}</g, '>{$1.toLocaleString()}<');
  content = content.replace(/>[^<]*\{([^}]+)\.toLocaleString\(\)\}</g, '>{$1.toLocaleString()}<');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
}
