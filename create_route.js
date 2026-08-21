const fs = require('fs');

const routeContent = `import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { employeeName, employeeEmail, leaveType, duration, days, reason, status } = await req.json();

    if (!employeeEmail) {
      return NextResponse.json({ error: 'No email provided' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
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
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;

fs.writeFileSync('app/api/send-leave-email/route.ts', routeContent);
console.log('Created send-leave-email API route!');
