const fs = require('fs');
const newHash = '3664395';
const newDate = '2026-05-09';

const files = [
    'docs/ARCHITECTURE.md',
    'docs/CURRENT_STATE.md',
    'docs/IMPLEMENTATION_STATUS.md',
    'docs/ROADMAP.md',
    'docs/TECH_DEBT.md',
    'docs/review/AUDIT_CAPABILITY_MATRIX.md',
    'docs/review/RECONCILIACAO_REPORT.md'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(/> \*\*Baseline:\*\* `[^`]+`/g, `> **Baseline:** \`${newHash}\``);
        content = content.replace(/\*\*Baseline:\*\* `[^`]+`/g, `**Baseline:** \`${newHash}\``);
        content = content.replace(/Baseline Commit:\*\* `[^`]+`/g, `Baseline Commit:** \`${newHash}\``);
        content = content.replace(/> \*\*Ultima [aA]tualizacao:\*\* \d{4}-\d{2}-\d{2}/g, `> **Ultima Atualizacao:** ${newDate}`);
        fs.writeFileSync(file, content, 'utf8');
    }
});
console.log('Update complete');
