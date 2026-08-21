const nodemailer = require("nodemailer");

async function testEmail() {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.zoho.com',
            port: 465,
            secure: true,
            auth: {
                user: 'damini@vectragroup.in',
                pass: 'Vectra@12345'
            }
        });

        console.log("Verifying connection to smtp.zoho.com...");
        await transporter.verify();
        console.log("Connection verified!");
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

testEmail();
