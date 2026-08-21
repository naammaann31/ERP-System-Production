const fs = require('fs');
const file = 'components/dashboard/MarketingClient.tsx';
let content = fs.readFileSync(file, 'utf8');

const bottomTarget = `                  </Card>
            </div>`;
            
const bottomBtn = `                  </Card>
            </div>
            
            <div className="mt-6 mb-12 flex justify-end">
                <button
                    onClick={() => setReportModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white hover:bg-purple-700 font-bold text-sm rounded-xl transition-all shadow-md whitespace-nowrap"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-table"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                    Generate Report
                </button>
            </div>`;

content = content.replace(bottomTarget, bottomBtn);

fs.writeFileSync(file, content);
console.log('Fixed bottom button injection');
