const fs = require('fs');
const file = 'app/dashboard/my-team/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// The file currently has a syntax error because of the IIFE in JSX.
// We need to extract the IIFE logic and put it before the `return` statement, 
// and fix the JSX.

const badSyntax = `{(() => {
        const teamReports = reports.filter(r => teamMembers.some(tm => tm.uid === r.user_id));
        const filteredByDate = filterDate ? teamReports.filter(r => r.report_date === filterDate) : teamReports;
        const fullyFiltered = filterEmployee !== "All" ? filteredByDate.filter(r => r.user_id === filterEmployee) : filteredByDate;

        const aggregatedReports = fullyFiltered.reduce((acc: any[], curr) => {
          const key = \`\${curr.user_id}_\${curr.report_date}\`;
          const existing = acc.find(x => x.key === key);
          if (existing) {
            existing.no_of_candidates += Number(curr.no_of_candidates || 0);
            existing.applications += Number(curr.applications || 0);
            existing.rtr_submissions += Number(curr.rtr_submissions || 0);
            existing.screenings += Number(curr.screenings || 0);
            existing.interviews += Number(curr.interviews || 0);
            existing.entries += 1;
          } else {
            acc.push({
              key,
              id: curr.id,
              user_id: curr.user_id,
              user_name: curr.user_name,
              report_date: curr.report_date,
              no_of_candidates: Number(curr.no_of_candidates || 0),
              applications: Number(curr.applications || 0),
              rtr_submissions: Number(curr.rtr_submissions || 0),
              screenings: Number(curr.screenings || 0),
              interviews: Number(curr.interviews || 0),
              entries: 1
            });
          }
          return acc;
        }, []);
        aggregatedReports.sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());

        return (`;

const closeBadSyntax = `        );
      })}`;

if (content.includes(badSyntax)) {
    // 1. Remove the IIFE closure
    content = content.replace(badSyntax, '');
    content = content.replace(closeBadSyntax, '');
    
    // 2. We are left with just the <Card>...</Card> block.
    // Let's insert the data aggregation logic right before `return (`
    
    const aggregationLogic = `
  const teamReports = reports.filter(r => teamMembers.some(tm => tm.uid === r.user_id));
  const filteredByDate = filterDate ? teamReports.filter(r => r.report_date === filterDate) : teamReports;
  const fullyFiltered = filterEmployee !== "All" ? filteredByDate.filter(r => r.user_id === filterEmployee) : filteredByDate;

  const aggregatedReports = fullyFiltered.reduce((acc: any[], curr) => {
    const key = \`\${curr.user_id}_\${curr.report_date}\`;
    const existing = acc.find((x: any) => x.key === key);
    if (existing) {
      existing.no_of_candidates += Number(curr.no_of_candidates || 0);
      existing.applications += Number(curr.applications || 0);
      existing.rtr_submissions += Number(curr.rtr_submissions || 0);
      existing.screenings += Number(curr.screenings || 0);
      existing.interviews += Number(curr.interviews || 0);
      existing.entries += 1;
    } else {
      acc.push({
        key,
        id: curr.id,
        user_id: curr.user_id,
        user_name: curr.user_name,
        report_date: curr.report_date,
        no_of_candidates: Number(curr.no_of_candidates || 0),
        applications: Number(curr.applications || 0),
        rtr_submissions: Number(curr.rtr_submissions || 0),
        screenings: Number(curr.screenings || 0),
        interviews: Number(curr.interviews || 0),
        entries: 1
      });
    }
    return acc;
  }, []);
  aggregatedReports.sort((a: any, b: any) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());

  return (`;
    
    content = content.replace('  return (', aggregationLogic);
    
    fs.writeFileSync(file, content);
    console.log('Successfully fixed syntax error!');
} else {
    console.log('Bad syntax block not found');
}
