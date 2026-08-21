const fs = require('fs');
const file = 'app/api/send-leave-email/route.ts';
let content = fs.readFileSync(file, 'utf8');

const oldConfig = `    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'damini@vectragroup.in',
        pass: 'Vectra@12345'
      }
    });`;

const newConfig = `    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.in',
      port: 465,
      secure: true,
      auth: {
        user: 'damini@vectragroup.in',
        pass: 'Vectra@12345'
      }
    });`;

content = content.replace(oldConfig, newConfig);
fs.writeFileSync(file, content);
console.log('Updated to use Zoho SMTP!');
