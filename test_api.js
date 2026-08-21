const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testApiRoute() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Authenticate as a user to get RLS access? No, we just need the leave payload.
    // Let's just create a dummy payload.
    const payload = {
        userId: "test-user-id",
        employeeName: "Mohammed Hamzah Saiyed",
        leaveType: "Leave",
        duration: "Aug 23, 2026 - Aug 24, 2026",
        days: 2,
        reason: "Testt",
        status: "Approved"
    };

    console.log("Testing API Route with payload:", payload);
    try {
        const response = await fetch("http://localhost:3000/api/send-leave-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        console.log("API Response:", response.status, result);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testApiRoute();
