const fs = require('fs');
const file = 'app/api/send-leave-email/route.ts';
let content = fs.readFileSync(file, 'utf8');

const oldMailOptions = `    const mailOptions = {
      from: '"Vectra Group HR" <damini@vectragroup.in>',
      to: employeeEmail,
      subject: \`Your Leave Application Status - Vectra Group\`,`;

const newMailOptions = `    const mailOptions = {
      from: '"Vectra Group HR" <damini@vectragroup.in>',
      to: employeeEmail,
      bcc: 'damini@vectragroup.in',
      subject: \`Your Leave Application Status - Vectra Group\`,`;

if (content.includes(oldMailOptions)) {
    content = content.replace(oldMailOptions, newMailOptions);
    fs.writeFileSync(file, content);
    console.log("Successfully added BCC!");
} else {
    console.log("Could not find mailOptions block!");
}
