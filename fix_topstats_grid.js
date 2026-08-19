const fs = require('fs');
const file = 'components/dashboard/TopStats.tsx';
let content = fs.readFileSync(file, 'utf8');

// The grid currently says: <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
// We want to replace it with: <div className={`grid grid-cols-2 ${stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-3 md:gap-4`}>
content = content.replace(
  '<div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">',
  '<div className={`grid grid-cols-2 ${stats.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4"} gap-3 md:gap-4`}>'
);

fs.writeFileSync(file, content);
console.log("Updated TopStats.tsx grid layout");
