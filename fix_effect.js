const fs = require('fs');
const file = 'components/dashboard/MarketingClient.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the dependency array
const oldDep = "}, [isOpen, profile, startDate, endDate, displayData]);";
const newDep = "}, [isOpen, profile, startDate, endDate]);";

content = content.replace(oldDep, newDep);

fs.writeFileSync(file, content);
console.log('Fixed useEffect dependency array!');
