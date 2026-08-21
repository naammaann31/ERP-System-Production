const fs = require('fs');
const file = 'app/dashboard/my-team/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// The block I accidentally inserted:
const badBlock = `  const teamReports = reports.filter(r => teamMembers.some(tm => tm.uid === r.user_id));
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
  aggregatedReports.sort((a: any, b: any) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());`;

if (content.includes(badBlock)) {
    // Remove it from the wrong place
    content = content.replace(badBlock, '');
    
    // Insert it before the main component return
    content = content.replace('  return (\n    <motion.div', badBlock + '\n\n  return (\n    <motion.div');
    fs.writeFileSync(file, content);
    console.log("Fixed the location of the aggregation logic!");
} else {
    console.log("Could not find the bad block!");
}
