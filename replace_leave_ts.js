const fs = require('fs');
const file = 'lib/leave.ts';
let content = fs.readFileSync(file, 'utf8');

const newHelpers = `
export const calculateMonthsEmployed = (dateOfJoining: string | undefined): number => {
  if (!dateOfJoining) return 1; // Default to 1 month if no date is set
  const joinDate = new Date(dateOfJoining);
  const now = new Date();
  
  if (isNaN(joinDate.getTime())) return 1;
  
  const yearsDiff = now.getFullYear() - joinDate.getFullYear();
  const monthsDiff = now.getMonth() - joinDate.getMonth();
  const totalMonths = (yearsDiff * 12) + monthsDiff;
  
  // They get 2 leaves for the current month they are in as well, so we add 1.
  return Math.max(1, totalMonths + 1);
};

export const calculateAccruedLeaves = (dateOfJoining: string | undefined): number => {
  const months = calculateMonthsEmployed(dateOfJoining);
  return months * 2;
};
`;

content += newHelpers;
fs.writeFileSync(file, content);
console.log('Update leave.ts complete');
