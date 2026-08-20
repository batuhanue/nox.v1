const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const duplicateRegex = /<button\s*onClick=\{\(\) => \{\s*triggerHaptic\('light'\);\s*setIsAiChatOpen\(true\);\s*setIsSettingsOpen\(false\);\s*\}\}[\s\S]*?Kanvas<\/span>\s*<\/button>\s*<div className="h-\[1px\] bg-black\/5 dark:bg-white\/5 my-1 mx-2" \/>/g;

let matches = 0;
code = code.replace(duplicateRegex, (match) => {
    matches++;
    // keep the first one, replace subsequent ones with empty string
    return matches === 1 ? match : '';
});

fs.writeFileSync('src/App.tsx', code);
console.log(`Replaced ${matches} occurrences (kept first).`);
