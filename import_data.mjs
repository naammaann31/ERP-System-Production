import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import * as xlsx from "xlsx";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runImport() {
    console.log("Fetching CSV from Google Sheets...");
    const url = "https://docs.google.com/spreadsheets/d/1am7rFQV4dZgdwWqGisZh3zMbgKprfYp64R_uaQ93nVA/export?format=csv&gid=2047999258";
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    
    const workbook = xlsx.read(arrayBuffer, { type: "array" });
    const wsname = workbook.SheetNames[0];
    const ws = workbook.Sheets[wsname];
    
    const rawData = xlsx.utils.sheet_to_json(ws, { defval: "", blankrows: true });
    
    let newCount = 0;
    
    console.log(`Found ${rawData.length} rows. Starting import...`);

    for (const row of rawData) {
        const originalName = row["__EMPTY"] || row["Name"] || row["name"] || "";
        let date = row["date "] || row["date"] || row["Date"] || "";
        const company = row["company name"] || row["Company Name"] || "";
        const link = row["link"] || row["Link"] || "";

        if (!originalName && !company) {
            continue;
        }

        if (typeof date === 'number') {
             date = new Date(Math.round((date - 25569)*86400*1000)).toISOString().split('T')[0];
        }
        
        if (!date || String(date).trim() === "") {
            date = new Date().toISOString().split('T')[0];
        }

        const payload = {
            "Name": "marketing rohit", // Hardcoded as requested
            "Original Name": originalName, // Preserve original just in case
            "Date": date,
            "Company Name": company,
            "Link": link,
            "marketing": "rohit", // Create new field as requested
            createdAt: serverTimestamp()
        };

        try {
            await addDoc(collection(db, "marketing"), payload);
            newCount++;
            if (newCount % 100 === 0) {
                console.log(`Imported ${newCount} rows...`);
            }
        } catch (e) {
            console.error("Error adding doc", e);
        }
    }
    
    console.log(`Import completed successfully! Total rows imported: ${newCount}`);
    process.exit(0);
}

runImport();
