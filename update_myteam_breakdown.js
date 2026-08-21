const fs = require('fs');
const file = 'app/dashboard/my-team/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `<td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">{report.applications}</td>`;

const replaceStr = `<td className="px-6 py-4 whitespace-nowrap text-center text-slate-700">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold">{report.applications}</span>
                        {report.candidate_breakdown && report.candidate_breakdown.length > 0 && (
                          <select className="text-[10px] border border-slate-200 rounded bg-slate-50 text-slate-600 outline-none max-w-[120px]" defaultValue="">
                            <option value="" disabled>Breakdown</option>
                            {report.candidate_breakdown.map((cb: any, i: number) => (
                              <option key={i} value={cb.name}>{cb.name}: {cb.applications}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync(file, content);
console.log('Update my-team breakdown complete');
