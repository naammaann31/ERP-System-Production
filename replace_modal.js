const fs = require('fs');
const file = 'components/dashboard/MarketingClient.tsx';
let content = fs.readFileSync(file, 'utf8');

// Inject the modal before the closing fragment
content = content.replace(
/<\/ConfirmModal>[\s]*?<\/>/i,
`</ConfirmModal>
            <GenerateReportModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} profile={profile} />
        </>`
);

// wait, the actual ending is `/>\s*</>\s*);` because ConfirmModal is self closing.
// Let's replace the whole ConfirmModal to be sure.
const regex = /<ConfirmModal[\s\S]*?\/>[\s]*<\/>/;
const replacement = content.match(regex);
if (replacement) {
    const newStr = replacement[0].replace('</>', '<GenerateReportModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} profile={profile} />\n        </>');
    content = content.replace(regex, newStr);
    fs.writeFileSync(file, content);
    console.log('Successfully added Modal render!');
} else {
    console.log('Could not find ConfirmModal block.');
}
