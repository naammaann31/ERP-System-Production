const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkData() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.log("No Supabase credentials found.");
        return;
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get latest leave requests
    const { data: leaves } = await supabase.from('leave_requests').select('*').order('applied_on', { ascending: false }).limit(2);
    console.log("Leaves:", leaves);

    if (leaves && leaves.length > 0) {
        for (const leave of leaves) {
            const { data: profile } = await supabase.from("profiles").select("email").eq("id", leave.user_id).single();
            console.log(`Profile for user ${leave.user_id}:`, profile);
            
            // Also check users table if it exists
            const { data: user } = await supabase.from("users").select("*").eq("id", leave.user_id).single();
            console.log(`User for user ${leave.user_id}:`, user);
        }
    }
}

checkData();
