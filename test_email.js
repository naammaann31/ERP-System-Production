const nodemailer = require("nodemailer");

async function testEmail() {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.zoho.in',
            port: 465,
            secure: true,
            auth: {
                user: 'damini@vectragroup.in',
                pass: 'Vectra@12345'
            }
        });

        console.log("Verifying connection...");
        await transporter.verify();
        console.log("Connection verified!");

        console.log("Sending test email...");
        const info = await transporter.sendMail({
            from: '"Vectra Group HR" <damini@vectragroup.in>',
            to: 'damini@vectragroup.in',
            subject: 'Test Email',
            text: 'This is a test email to verify SMTP configuration.'
        });
        console.log("Test email sent!", info.messageId);
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

testEmail();
