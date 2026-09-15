const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const dir = 'C:\\Users\\ADMIN\\Desktop\\sheets';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));

for (const file of files) {
    const filePath = path.join(dir, file);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`FILE: ${file}`);
    console.log('='.repeat(70));
    
    try {
        // Read without cellDates to get raw values
        const wb = XLSX.readFile(filePath, { cellDates: false });
        console.log(`Sheets: ${wb.SheetNames.join(', ')}`);
        
        const ws = wb.Sheets[wb.SheetNames[0]];
        const range = ws['!ref'];
        console.log(`Range: ${range || 'EMPTY'}`);
        console.log(`Merges: ${JSON.stringify(ws['!merges'] || 'none')}`);
        
        if (!range) {
            console.log('*** EMPTY WORKBOOK — no data ***');
            continue;
        }
        
        // Get raw data with header:1 (array of arrays)
        const rawArr = XLSX.utils.sheet_to_json(ws, { defval: "", blankrows: true, raw: true, header: 1 });
        console.log(`Total rows (including blanks): ${rawArr.length}`);
        
        // Show first 5 rows
        console.log('\nFirst 5 rows:');
        for (let i = 0; i < Math.min(5, rawArr.length); i++) {
            console.log(`  Row ${i}: ${JSON.stringify(rawArr[i])}`);
        }
        
        // Show headers (find first non-empty row)
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, rawArr.length); i++) {
            const row = rawArr[i];
            if (row && row.some(c => typeof c === 'string' && c.trim().length > 0)) {
                // Check if it looks like a header (contains text, not just numbers)
                const hasText = row.some(c => typeof c === 'string' && /[a-zA-Z]/.test(c));
                if (hasText) {
                    headerRowIdx = i;
                    break;
                }
            }
        }
        
        if (headerRowIdx >= 0) {
            console.log(`\nDetected header row index: ${headerRowIdx}`);
            console.log(`Headers: ${JSON.stringify(rawArr[headerRowIdx])}`);
        } else {
            console.log('\nCould not detect header row');
        }
        
        // Inspect date column cells directly
        if (headerRowIdx >= 0) {
            const headers = rawArr[headerRowIdx].map(h => String(h || '').trim().toLowerCase());
            const dateColIdx = headers.findIndex(h => h.includes('date'));
            
            if (dateColIdx >= 0) {
                console.log(`\nDate column index: ${dateColIdx} (header: "${rawArr[headerRowIdx][dateColIdx]}")`);
                
                // Show first 5 non-empty date values
                let found = 0;
                for (let i = headerRowIdx + 1; i < rawArr.length && found < 5; i++) {
                    const val = rawArr[i][dateColIdx];
                    if (val !== '' && val !== undefined && val !== null) {
                        console.log(`  Row ${i}: value=${JSON.stringify(val)}, type=${typeof val}`);
                        
                        // Also check the actual cell
                        const colLetter = XLSX.utils.encode_col(dateColIdx);
                        const cellAddr = colLetter + (i + 1);
                        const cell = ws[cellAddr];
                        if (cell) {
                            console.log(`    Cell ${cellAddr}: t=${cell.t}, v=${cell.v}, w="${cell.w}"`);
                        }
                        found++;
                    }
                }
                
                // Count unique date values
                const uniqueDates = new Set();
                let blankDates = 0;
                for (let i = headerRowIdx + 1; i < rawArr.length; i++) {
                    const val = rawArr[i][dateColIdx];
                    if (val === '' || val === undefined || val === null) {
                        blankDates++;
                    } else {
                        uniqueDates.add(val);
                    }
                }
                console.log(`  Unique date values: ${uniqueDates.size}`);
                console.log(`  Blank date cells: ${blankDates}`);
            } else {
                console.log('\nNo date column found in headers');
            }
            
            // Show all column names
            const nameColIdx = headers.findIndex(h => h.includes('name') && !h.includes('company'));
            const companyColIdx = headers.findIndex(h => h.includes('company'));
            const linkColIdx = headers.findIndex(h => h.includes('link') || h.includes('url'));
            
            console.log(`\nColumn mapping:`);
            console.log(`  Name: col ${nameColIdx} ("${rawArr[headerRowIdx][nameColIdx] || 'NOT FOUND'}")`);
            console.log(`  Date: col ${dateColIdx >= 0 ? dateColIdx : 'NOT FOUND'}`);
            console.log(`  Company: col ${companyColIdx} ("${rawArr[headerRowIdx][companyColIdx] || 'NOT FOUND'}")`);
            console.log(`  Link: col ${linkColIdx} ("${rawArr[headerRowIdx][linkColIdx] || 'NOT FOUND'}")`);
            
            // Extra columns
            const mapped = new Set([nameColIdx, dateColIdx, companyColIdx, linkColIdx]);
            const extras = [];
            for (let c = 0; c < rawArr[headerRowIdx].length; c++) {
                if (!mapped.has(c) && rawArr[headerRowIdx][c]) {
                    extras.push(`col ${c}: "${rawArr[headerRowIdx][c]}"`);
                }
            }
            if (extras.length > 0) {
                console.log(`  Extra columns: ${extras.join(', ')}`);
            }
        }
        
        // Count actual data rows (non-empty)
        let dataRows = 0;
        for (let i = (headerRowIdx >= 0 ? headerRowIdx + 1 : 1); i < rawArr.length; i++) {
            const row = rawArr[i];
            if (row && row.some(c => c !== '' && c !== undefined && c !== null)) {
                dataRows++;
            }
        }
        console.log(`\nData rows (non-empty): ${dataRows}`);
        
    } catch (err) {
        console.log(`ERROR: ${err.message}`);
    }
}
