const fs = require('fs');
const file = 'components/dashboard/MarketingClient.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update the state to include breakdown
content = content.replace(
/const \[stats, setStats\] = useState\(\{ candidates: 0, applications: 0, screenings: 0, interviews: 0 \}\);/,
`const [stats, setStats] = useState({ candidates: 0, applications: 0, screenings: 0, interviews: 0, breakdown: [] as {name: string, applications: number}[] });`
);

// 2. Update the fetchStats logic
const fetchStatsReplacement = `            // Number of unique candidates from the leads table view
            const breakdownObj: Record<string, number> = {};
            displayData.forEach(d => {
                const name = d.Name || d.CandidateName || "Unknown";
                breakdownObj[name] = (breakdownObj[name] || 0) + 1;
            });
            const breakdownArray = Object.keys(breakdownObj).map(k => ({ name: k, applications: breakdownObj[k] }));

            setStats({
                candidates: breakdownArray.length, 
                applications: applicationsCount,
                screenings,
                interviews,
                breakdown: breakdownArray
            });`;

content = content.replace(
/\/\/ Number of unique candidates from the leads table view[\s\S]*?interviews\n\s*\}\);/,
fetchStatsReplacement
);

// 3. Update the insert statement in handleSubmit
const insertReplacement = `const { error } = await supabase.from("marketing_daily_reports").insert({
                user_id: profile.uid,
                user_name: profile.fullName || "Unknown",
                report_date: today,
                no_of_candidates: stats.candidates,
                applications: stats.applications,
                rtr_submissions: parseInt(rtr) || 0,
                screenings: stats.screenings,
                interviews: stats.interviews,
                candidate_breakdown: stats.breakdown
            });`;

content = content.replace(
/const \{ error \} = await supabase\.from\("marketing_daily_reports"\)\.insert\(\{[\s\S]*?interviews: stats\.interviews\n\s*\}\);/,
insertReplacement
);

fs.writeFileSync(file, content);
console.log('Update MarketingClient complete');
