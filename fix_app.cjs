const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// The rogue block at line 721-731:
const rogueBlock = `                  <motion.button 
              aria-label="Yeni Görev Ekle"
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              onClick={() => { triggerHaptic('medium'); setIsAdding(true); }}
              style={{ WebkitTapHighlightColor: "transparent" }}
              className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shadow-sm relative z-40"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </motion.button>
          </div>
        </header>`;

// Let's find it and remove it.
if (code.includes(rogueBlock)) {
  code = code.replace(rogueBlock + '\n', '');
  console.log("Removed rogue block.");
} else {
  console.log("Rogue block NOT found!");
}

// Now let's add it back to the proper place in the main header.
// The main header has `isSettingsOpen` block ending with `</AnimatePresence>` at line ~1503.
// Right after that, before `<MobileDock`, we need to insert the rogue block.
const insertionPoint = `                </>
              )}
            </AnimatePresence>`;

if (code.includes(insertionPoint)) {
  code = code.replace(insertionPoint, insertionPoint + '\n            ' + rogueBlock.trim());
  console.log("Inserted rogue block at the correct place.");
} else {
  console.log("Insertion point NOT found!");
}

fs.writeFileSync('src/App.tsx', code);
