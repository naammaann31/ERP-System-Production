const fs = require('fs');

const filesToFix = [
    'components/dashboard/attendance/HRAttendanceDashboard.tsx',
    'components/dashboard/CandidatesClient.tsx',
    'components/dashboard/departments/SalesDataSection.tsx',
    'components/dashboard/InterviewScreeningClient.tsx',
    'components/dashboard/MarketingClient.tsx',
    'components/dashboard/OperationsClient.tsx',
    'components/payroll/PayslipDocument.tsx'
];

for (const file of filesToFix) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    // We only want to wrap tables if they aren't already wrapped.
    // Replace `<table ` with `<div className="overflow-x-auto w-full max-w-full"><table `
    // Replace `</table>` with `</table></div>`
    
    // But we need to make sure we don't double wrap. 
    // It's safer to use a regex to wrap the whole table block.
    // `/<table[\s\S]*?<\/table>/g`
    
    content = content.replace(/<table[\s\S]*?<\/table>/g, (match) => {
        // Check if the file already has 'overflow-x-auto' around this table (e.g. from a previous run)
        // Since we are matching just the table, we can just wrap it.
        return `<div className="overflow-x-auto w-full max-w-full">\n${match}\n</div>`;
    });

    fs.writeFileSync(file, content);
    console.log("Wrapped tables in " + file);
}
