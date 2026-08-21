const fs = require('fs');
const file = 'components/dashboard/MarketingClient.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                              <button
                                  onClick={handleExport}
                                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 font-semibold text-sm rounded-xl transition-all border border-emerald-200 shadow-sm whitespace-nowrap"
                                  title="Export as Excel"
                              >`;

const replaceStr = `                              <button
                                  onClick={() => setReportModalOpen(true)}
                                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 font-semibold text-sm rounded-xl transition-all border border-purple-200 shadow-sm whitespace-nowrap"
                                  title="Generate Daily Report"
                              >
                                  <TableIcon className="w-4 h-4" />
                                  Generate Report
                              </button>
                              <button
                                  onClick={handleExport}
                                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 font-semibold text-sm rounded-xl transition-all border border-emerald-200 shadow-sm whitespace-nowrap"
                                  title="Export as Excel"
                              >`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync(file, content);
console.log('Update button complete');
