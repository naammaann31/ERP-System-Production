const fs = require('fs');
const file = 'app/api/send-leave-email/route.ts';

const routeContent = `import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { userId, employeeName, leaveType, duration, days, reason, status } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'No user ID provided' }, { status: 400 });
    }

    // Initialize Supabase Admin Client to bypass RLS and fetch user email
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Get user's email directly from auth.users (most reliable)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    let employeeEmail = user?.email;

    // Fallback to profiles table if auth.users fails or returns nothing
    if (!employeeEmail) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('id', userId).single();
        employeeEmail = profile?.email;
    }

    if (!employeeEmail) {
      return NextResponse.json({ error: 'Could not resolve email for user ' + userId }, { status: 404 });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: {
        user: 'damini@vectragroup.in',
        pass: 'Vectra@12345'
      }
    });

    const mailOptions = {
      from: '"Vectra Group HR" <damini@vectragroup.in>',
      to: employeeEmail,
      subject: \`Your Leave Application Status - Vectra Group\`,
      text: \`Dear \${employeeName},

Your leave application has been \${status}.

Details:
Employee Name: \${employeeName}
Leave Type: \${leaveType}
Duration: \${duration}
Days: \${days}
Reason: \${reason}
Status: \${status}

If you have any questions, please contact HR.\`
    };

    const info = await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true, messageId: info.messageId, sentTo: employeeEmail });
  } catch (error: any) {
    console.error('Email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;

fs.writeFileSync(file, routeContent);
console.log('Updated API route to fetch email via Supabase Admin!');
