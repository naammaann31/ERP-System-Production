import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import fs from 'fs';

import path from 'path';

const EXCEL_PATH = path.join(process.cwd(), 'Lead Sheet.xlsx');

export async function GET() {
    try {
        if (!fs.existsSync(EXCEL_PATH)) {
            return NextResponse.json({ error: 'Excel file not found' }, { status: 404 });
        }
        
        const fileBuffer = fs.readFileSync(EXCEL_PATH);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
        
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error reading Excel:", error);
        return NextResponse.json({ error: 'Failed to read Excel file', details: error.message, stack: error.stack }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        if (!fs.existsSync(EXCEL_PATH)) {
            return NextResponse.json({ error: 'Excel file not found' }, { status: 404 });
        }
        
        const fileBuffer = fs.readFileSync(EXCEL_PATH);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const data = xlsx.utils.sheet_to_json(sheet);
        
        // Append new row
        data.push(body);
        
        // Write back to sheet
        const newSheet = xlsx.utils.json_to_sheet(data);
        workbook.Sheets[sheetName] = newSheet;
        
        const outBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fs.writeFileSync(EXCEL_PATH, outBuffer);
        
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error writing to Excel:", error);
        return NextResponse.json({ error: 'Failed to write to Excel file', details: error.message, stack: error.stack }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { rowIndex, candidateName, contactNumber, status } = await request.json();
        
        if (!fs.existsSync(EXCEL_PATH)) {
            return NextResponse.json({ error: 'Excel file not found' }, { status: 404 });
        }
        
        const fileBuffer = fs.readFileSync(EXCEL_PATH);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const data = xlsx.utils.sheet_to_json(sheet);
        
        let targetIndex = rowIndex;

        // Safety check if row shifted or wasn't provided
        if (targetIndex === undefined || data[targetIndex]?.["Candidate Name "] !== candidateName) {
            targetIndex = data.findIndex((r: any) => 
                r["Candidate Name "] === candidateName && 
                r["Contact Number"] === contactNumber
            );
        }

        if (targetIndex !== -1) {
            (data[targetIndex] as any)["Status"] = status;
            
            // Write back
            const newSheet = xlsx.utils.json_to_sheet(data);
            workbook.Sheets[sheetName] = newSheet;
            
            const outBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            fs.writeFileSync(EXCEL_PATH, outBuffer);
            
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Row not found' }, { status: 404 });
        }
    } catch (error: any) {
        console.error("Error updating Excel:", error);
        return NextResponse.json({ error: 'Failed to update Excel file', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { rowIndex, candidateName, contactNumber } = await request.json();
        
        if (!fs.existsSync(EXCEL_PATH)) {
            return NextResponse.json({ error: 'Excel file not found' }, { status: 404 });
        }
        
        const fileBuffer = fs.readFileSync(EXCEL_PATH);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const data = xlsx.utils.sheet_to_json(sheet);
        
        let targetIndex = rowIndex;

        // Safety check if row shifted or wasn't provided
        if (targetIndex === undefined || data[targetIndex]?.["Candidate Name "] !== candidateName) {
            targetIndex = data.findIndex((r: any) => 
                r["Candidate Name "] === candidateName && 
                r["Contact Number"] === contactNumber
            );
        }

        if (targetIndex !== -1) {
            data.splice(targetIndex, 1);
            
            // Write back
            const newSheet = xlsx.utils.json_to_sheet(data);
            workbook.Sheets[sheetName] = newSheet;
            
            const outBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            fs.writeFileSync(EXCEL_PATH, outBuffer);
            
            return NextResponse.json({ success: true });
        }
        
        return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    } catch (error: any) {
        console.error("Error deleting from Excel:", error);
        return NextResponse.json({ error: 'Failed to delete from Excel file', details: error.message }, { status: 500 });
    }
}
