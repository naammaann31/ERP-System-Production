export interface OperationsImportDecision {
    kind: "invalid" | "duplicate" | "insert";
    payload?: Record<string, any>;
}

/**
 * Decides what a single imported row becomes, mirroring the per-row logic
 * that used to live inline in OperationsClient's handleFileUpload: skip if
 * there's no candidate name, skip as a duplicate if an existing row already
 * matches by email/contact (or by name when neither is present), otherwise
 * build the insertable UI payload (normalising an Excel serial date, or
 * defaulting to today when the date is blank).
 */
export function classifyOperationsImportRow(
    row: any,
    existingData: any[],
    internalNameFallback: string
): OperationsImportDecision {
    // Check invalid (Must have Candidate Name at least)
    if (!row["Candidate Name "]) {
        return { kind: "invalid" };
    }

    // Check duplicate in `existingData`
    const isDuplicate = existingData.some(d => {
        const emailMatch = row["Email"] && d["Email"] && d["Email"].toLowerCase() === row["Email"].toLowerCase();
        const contactMatch = row["Contact Number"] && d["Contact Number"] && String(d["Contact Number"]) === String(row["Contact Number"]);

        if (emailMatch || contactMatch) return true;

        if (!row["Email"] && !row["Contact Number"]) {
             return d["Candidate Name "]?.toLowerCase() === row["Candidate Name "]?.toLowerCase();
        }
        return false;
    });

    if (isDuplicate) {
        return { kind: "duplicate" };
    }

    // Format date correctly if it's an excel serial number
    let formattedDate = row["Date"];
    if (typeof formattedDate === 'number') {
         formattedDate = new Date(Math.round((formattedDate - 25569)*86400*1000)).toISOString().split('T')[0];
    }

    // Default to today if date is blank
    if (!formattedDate || String(formattedDate).trim() === "") {
        formattedDate = new Date().toISOString().split('T')[0];
    }

    const uiPayload = {
        "Date": formattedDate,
        "Candidate Name ": row["Candidate Name "] || "",
        "Contact Number": row["Contact Number"] ? String(row["Contact Number"]) : "",
        "Email": row["Email"] || "",
        "Visa Status": row["Visa Status"] || "",
        "Job Role": row["Job Role"] || "",
        "Exp": row["Exp"] ? String(row["Exp"]) : "",
        "Location": row["Location"] || "",
        "Internal Name": row["Internal Name"] || internalNameFallback,
        "Linkedln Profile URL": row["Linkedln Profile URL"] || row["LinkedIn Profile URL"] || "",
        "Feedback": row["Feedback"] || "",
        "Status": row["Status"] || row["Feedback"] || "New",
    };

    return { kind: "insert", payload: uiPayload };
}
