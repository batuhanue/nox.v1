const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const insertionPoint = `                </>
              )}
            </AnimatePresence>`;

const buttonBlock = `
            <motion.button 
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

if (code.includes(insertionPoint)) {
  code = code.replace(insertionPoint, insertionPoint + buttonBlock);
  console.log("Inserted button block");
}

fs.writeFileSync('src/App.tsx', code);
