"use server";

import * as xlsx from "xlsx";

const SPREADSHEET_ID = "1am7rFQV4dZgdwWqGisZh3zMbgKprfYp64R_uaQ93nVA";

export interface InterviewRow {
    id: string;
    /** Content signature (date|candidate|client) used to attach ERP-side
     *  Remark edits to this row. Stable across row inserts/reordering in
     *  the sheet, unlike a row number. */
    sig: string;
    date: string;
    candidate: string;
    client: string;
    stage: string;
    recruiter: string;
    remarks: string;
}

export interface ScreeningRow {
    id: string;
    sig: string;
    date: string;
    candidate: string;
    client: string;
    method: string;
    recruiter: string;
    remarks: string;
}

/**
 * Fetches the "interview&screening" tab (gid=868230713) of the Marketing
 * Team sheet. That tab holds two independent side-by-side tables:
 * columns A–F are Interview records, columns G–L are Screening records,
 * each with its own row count (blank cells pad the shorter one). Row 0 is
 * the group header ("Interview" / "Screening"), row 1 is the column
 * headers, and data starts at row 2.
 */
export async function fetchInterviewScreeningData(): Promise<{
    interviews: InterviewRow[];
    screenings: ScreeningRow[];
    error?: string;
}> {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=868230713`;

    try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`Sheet responded ${response.status}`);

        // Google occasionally answers with an HTML page (sign-in / throttle)
        // instead of CSV; without this guard the parser fails with a
        // confusing "could not find <table>" error.
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("csv")) {
            throw new Error(`Expected CSV but got "${contentType}"`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const workbook = xlsx.read(arrayBuffer, { type: "array" });
        const ws = workbook.Sheets[workbook.SheetNames[0]];

        // header: 1 gives positional arrays — required here because the two
        // sections repeat column names (Date/Candidate/Client/...), which
        // would collide if parsed into keyed objects.
        const rows = xlsx.utils.sheet_to_json<any[]>(ws, {
            header: 1,
            defval: "",
            blankrows: true,
        });

        const cell = (row: any[], i: number) => String(row?.[i] ?? "").trim();
        const hasContent = (row: any[], from: number, to: number) => {
            for (let i = from; i <= to; i++) {
                if (cell(row, i) !== "") return true;
            }
            return false;
        };
        // Signature over date|candidate|client — verified unique across all
        // 91 rows currently in the sheet.
        const signature = (row: any[], base: number) =>
            [base, base + 1, base + 2]
                .map((i) => cell(row, i).toLowerCase().replace(/\s+/g, " "))
                .join("|");

        const interviews: InterviewRow[] = [];
        const screenings: ScreeningRow[] = [];

        // Skip row 0 (group header) and row 1 (column headers).
        for (let r = 2; r < rows.length; r++) {
            const row = rows[r] || [];

            if (hasContent(row, 0, 5)) {
                interviews.push({
                    id: `interview-${r}`,
                    sig: signature(row, 0),
                    date: cell(row, 0),
                    candidate: cell(row, 1),
                    client: cell(row, 2),
                    stage: cell(row, 3),
                    recruiter: cell(row, 4),
                    remarks: cell(row, 5),
                });
            }

            if (hasContent(row, 6, 11)) {
                screenings.push({
                    id: `screening-${r}`,
                    sig: signature(row, 6),
                    date: cell(row, 6),
                    candidate: cell(row, 7),
                    client: cell(row, 8),
                    method: cell(row, 9),
                    recruiter: cell(row, 10),
                    remarks: cell(row, 11),
                });
            }
        }

        return { interviews, screenings };
    } catch (e: any) {
        console.error("Error fetching Interview & Screening sheet:", e);
        return {
            interviews: [],
            screenings: [],
            error: "Could not load the Interview & Screening sheet. Check that the sheet is still shared as viewable by anyone with the link.",
        };
    }
}

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

import { createClient } from "@supabase/supabase-js";

export async function submitMarketingDailyReport(data: any) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from("marketing_daily_reports").insert(data);
    
    if (error) {
        console.error("Error inserting report:", error);
        throw new Error(error.message);
    }
    
    return { success: true };
}

export async function getMarketingDailyReports() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase credentials");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from("marketing_daily_reports").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteMarketingDailyReport(id: number) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase credentials");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from("marketing_daily_reports").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function updateMarketingDailyReport(id: number, updateData: any) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase credentials");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from("marketing_daily_reports").update(updateData).eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function submitTeamLeadReport(data: any) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase credentials");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from("team_lead_reports").insert(data);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function getTeamLeadReports() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase credentials");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from("team_lead_reports").select("*").order("report_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
}
