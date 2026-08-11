// Maps between the clean snake_case `sales`/`marketing` Postgres columns and
// the legacy spreadsheet-style display keys the existing UI components were
// built around (e.g. row["Candidate Name "]). Keeping these mapping
// functions isolated means the large table-rendering JSX in
// OperationsClient/SalesDataSection/MarketingClient never has to change.

export function salesRowToUi(row: any) {
  return {
    id: row.id,
    Date: row.date,
    "Candidate Name ": row.candidate_name,
    "Contact Number": row.contact_number,
    Email: row.email,
    "Visa Status": row.visa_status,
    "Job Role": row.job_role,
    Exp: row.experience,
    Location: row.location,
    "Internal Name": row.internal_name,
    "Linkedln Profile URL": row.linkedin_url,
    Feedback: row.feedback,
    Status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at ? { seconds: new Date(row.created_at).getTime() / 1000 } : null,
  };
}

export function salesUiToRow(ui: any, createdBy: string | null) {
  return {
    date: ui["Date"] || null,
    candidate_name: ui["Candidate Name "] || null,
    contact_number: ui["Contact Number"] || null,
    email: ui["Email"] || null,
    visa_status: ui["Visa Status"] || null,
    job_role: ui["Job Role"] || null,
    experience: ui["Exp"] || null,
    location: ui["Location"] || null,
    internal_name: ui["Internal Name"] || null,
    linkedin_url: ui["Linkedln Profile URL"] || null,
    feedback: ui["Feedback"] || null,
    status: ui["Status"] || "New",
    created_by: createdBy,
  };
}

export function marketingRowToUi(row: any) {
  return {
    id: row.id,
    Name: row.candidate_name,
    Date: row.date,
    "Company Name": row.company_name,
    Link: row.link,
    marketing: row.created_by_name,
    userId: row.created_by,
    createdAt: row.created_at ? { seconds: new Date(row.created_at).getTime() / 1000 } : null,
  };
}

export function marketingUiToRow(ui: any, createdBy: string | null, createdByName: string | null) {
  return {
    candidate_name: ui["Name"] || null,
    date: ui["Date"] || null,
    company_name: ui["Company Name"] || null,
    link: ui["Link"] || null,
    created_by: createdBy,
    created_by_name: createdByName,
  };
}
