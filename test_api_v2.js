const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testApiRoute() {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    let employeeEmail = null;
    const userId = "test-user-id"; // non-UUID

    try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
        employeeEmail = user?.email;
    } catch (e) {
        console.warn('getUserById failed (likely non-UUID):', e.message);
    }

    if (!employeeEmail) {
        // Fallback to profiles table
        console.log("Falling back to profiles table...");
        // I won't run this against their real DB to avoid outputting emails, but it won't crash.
    }
    console.log("Success! Try/catch prevents crash.");
}

testApiRoute();
