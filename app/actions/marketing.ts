"use server";

import * as xlsx from "xlsx";

export async function fetchMarketingData() {
    // URL for Rohit's specific tab (gid=2047999258)
    const url = `https://docs.google.com/spreadsheets/d/1am7rFQV4dZgdwWqGisZh3zMbgKprfYp64R_uaQ93nVA/export?format=csv&gid=2047999258`;
    
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error("Failed to fetch CSV");
        
        const arrayBuffer = await response.arrayBuffer();
        
        const workbook = xlsx.read(arrayBuffer, { type: "array" });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        
        // Read as json, header row is index 0
        const rawData = xlsx.utils.sheet_to_json(ws, { defval: "", blankrows: true });
        
        const formattedData = rawData.map((row: any, index: number) => {
            const name = row["__EMPTY"] || row["Name"] || row["name"] || "";
            let date = row["date "] || row["date"] || row["Date"] || "";
            const company = row["company name"] || row["Company Name"] || "";
            const link = row["link"] || row["Link"] || "";
            
            // Format Excel serial date if necessary
            if (typeof date === 'number') {
                 date = new Date(Math.round((date - 25569)*86400*1000)).toISOString().split('T')[0];
            }
            
            return {
                id: `csv-row-${index}`, // fake id for react keys
                "Name": name,
                "Date": date,
                "Company Name": company,
                "Link": link
            };
        });
        
        return formattedData;
    } catch (e) {
        console.error("Error fetching Marketing Google Sheet data:", e);
        return [];
    }
}
