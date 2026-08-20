const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<\/AnimatePresence>\s*<\/div>\s*<\/div>\s*\);\s*\}/g;

if (regex.test(code)) {
  code = code.replace(regex, `
        </AnimatePresence>
        <AiChat isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} />
      </div>
    </div>
  );
}`);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Fixed!");
} else {
  console.log("Regex didn't match. Here are the last lines:");
  console.log(code.slice(-100));
}
