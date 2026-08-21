const fs = require('fs');
const file = 'components/dashboard/MarketingClient.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove from top
const topBtn = `                              <button
                                  onClick={() => setReportModalOpen(true)}
                                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 font-semibold text-sm rounded-xl transition-all border border-purple-200 shadow-sm whitespace-nowrap"
                                  title="Generate Daily Report"
                              >
                                  <TableIcon className="w-4 h-4" />
                                  Generate Report
                              </button>
`;
content = content.replace(topBtn, "");

// Add to bottom
// The bottom of the card is usually around the Pagination or the end of the </div> of the card.
// Let's find the end of the Card.
const bottomTarget = `                  </Card>
              </motion.div>`;
              
const bottomBtn = `                  </Card>
                  
                  <div className="mt-4 flex justify-end">
                      <button
                          onClick={() => setReportModalOpen(true)}
                          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white hover:bg-purple-700 font-bold text-sm rounded-xl transition-all shadow-md whitespace-nowrap"
                      >
                          <TableIcon className="w-4 h-4" />
                          Generate Report
                      </button>
                  </div>
              </motion.div>`;

content = content.replace(bottomTarget, bottomBtn);

fs.writeFileSync(file, content);
console.log('Moved button to bottom');
