const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// The block to match and extract
const settingsBlockStart = `<AnimatePresence>
              {isSettingsOpen && (`;
const settingsBlockRegex = /<AnimatePresence>[\s\S]*?\{isSettingsOpen && \([\s\S]*?<\/AnimatePresence>/;

const match = appCode.match(settingsBlockRegex);
if (match) {
  let settingsBlock = match[0];
  
  // Remove from original location
  appCode = appCode.replace(settingsBlock, "");
  
  // Update the classes of the motion.div to work for both desktop and mobile
  // Mobile: bottom sheet/popover style, Desktop: top right
  settingsBlock = settingsBlock.replace(
    /className="absolute top-12 right-12 mt-2 w-48 bg-white dark:bg-\[#1c1c1e\] rounded-2xl shadow-xl border border-black\/5 dark:border-white\/5 p-2 z-40"/,
    `className="fixed md:absolute md:top-12 md:right-12 bottom-28 left-1/2 -translate-x-1/2 md:bottom-auto md:left-auto md:translate-x-0 md:mt-2 w-56 md:w-48 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl rounded-2xl shadow-xl border border-black/5 dark:border-white/5 p-2 z-[70]"`
  );
  
  // Also change fixed inset z-30 to z-60 for mobile clickaway
  settingsBlock = settingsBlock.replace(/z-30/g, 'z-[60]');

  // Add the new buttons
  const aiChatBtn = `
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setIsAiChatOpen(true);
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <MessageCircle className="w-4 h-4 text-black/60 dark:text-white/60" />
                      <span className="text-[0.8125rem] font-semibold text-black/80 dark:text-white/80">Yapay Zeka Sohbeti</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setView('kanvas');
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <LayoutDashboard className="w-4 h-4 text-black/60 dark:text-white/60" />
                      <span className="text-[0.8125rem] font-semibold text-black/80 dark:text-white/80">Kanvas</span>
                    </button>
                    <div className="h-[1px] bg-black/5 dark:bg-white/5 my-1 mx-2" />
`;

  // Insert buttons after "Bildirimler" block (which ends with </button>)
  settingsBlock = settingsBlock.replace(
    /(<span className="text-\[0\.8125rem\] font-semibold text-black\/80 dark:text-white\/80">\s*Bildirimler\s*<\/span>\s*<\/div>[\s\S]*?<\/button>\s*<div className="h-\[1px\] bg-black\/5 dark:bg-white\/5 my-1 mx-2" \/>)/,
    `$1\n${aiChatBtn}`
  );

  // Now, where do we re-insert the settingsBlock? 
  // Let's put it right before <MobileDock view={view} setView={setView} setIsAdding={setIsAdding} setIsSettingsOpen={setIsSettingsOpen} />
  appCode = appCode.replace(
    /<MobileDock/, 
    `${settingsBlock}\n        <MobileDock`
  );
  
  fs.writeFileSync('src/App.tsx', appCode);
  console.log("Replaced settings block and updated position.");
} else {
  console.log("Settings block not found");
}
