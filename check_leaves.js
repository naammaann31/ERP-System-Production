const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkData() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get latest leave requests for Mohammed Hamzah Saiyed
    const { data: leaves, error } = await supabase.from('leave_requests').select('*').order('applied_on', { ascending: false }).limit(10);
    console.log("Leaves:", leaves);
    if (error) console.log("Error:", error);
}

checkData();
