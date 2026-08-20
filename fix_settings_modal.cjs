const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /(<AnimatePresence>\s*\{isSettingsOpen && \([\s\S]*?<\/AnimatePresence>)/;
const match = code.match(regex);

if (match) {
  const settingsModalCode = match[1];
  code = code.replace(regex, ''); // Remove from header
  
  // Clean up duplicates from the modal code
  const cleanedModalCode = settingsModalCode
    .replace(/(<button[\s\S]*?<MessageCircle[\s\S]*?<\/button>\s*<button[\s\S]*?<LayoutDashboard[\s\S]*?<\/button>\s*<div className="h-\[1px\] bg-black\/5 dark:bg-white\/5 my-1 mx-2" \/>\s*)/g, (match, p1, offset, string) => {
        // Just return the first one, we'll replace globally but we want to keep one.
        // Wait, it's easier to write a specific replacement if it's duplicated.
        return match;
    });
    
  // Let's just do a simple replacement for the duplicate block
  let finalModalCode = settingsModalCode.replace(
      /<button\s*onClick=\{\(\) => \{\s*triggerHaptic\('light'\);\s*setIsAiChatOpen\(true\);\s*setIsSettingsOpen\(false\);\s*\}\}[\s\S]*?Kanvas<\/span>\s*<\/button>\s*<div className="h-\[1px\] bg-black\/5 dark:bg-white\/5 my-1 mx-2" \/>/g, 
      (match, offset, str) => {
          // If it happens twice, we can remove the second occurrence. We can just use standard replace, it will replace all occurrences.
          return match;
      }
  );
  
  // Okay, maybe just doing it manually in the code is better.
  
  // Insert it after MobileDock
  code = code.replace(/(<MobileDock [\s\S]*?\/>)/, `$1\n\n        {/* Settings Modal - Moved out of hidden header */}\n        ${settingsModalCode}`);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Moved successfully.");
} else {
  console.log("Could not find the AnimatePresence block.");
}
