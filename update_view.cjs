const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace AI Recommendations with Gmail
const aiRegex = /<div className="mb-14">\s*<div className="flex items-center gap-2 mb-4">\s*<Bot className="w-4 h-4 text-black\/40 dark:text-white\/40" \/>\s*<h2 className="text-\[0\.6875rem\] font-bold text-black\/40 dark:text-white\/40 uppercase tracking-widest">Yapay Zeka Önerileri<\/h2>\s*<\/div>\s*\{aiRecommendation \? \([\s\S]*?\) : \([\s\S]*?<\/button>\s*\)\}\s*<\/div>/;

const gmailContent = `
      <div className="mb-14">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-black/40 dark:text-white/40" />
            <h2 className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">Gelen Kutusu (Gmail)</h2>
          </div>
          {!gmailToken && (
            <button
              onClick={handleGmailLogin}
              className="text-[0.625rem] font-bold bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors text-black/80 dark:text-white/80"
            >
              Bağlan
            </button>
          )}
        </div>
        
        {gmailToken ? (
          isFetchingEmails ? (
            <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-5 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-black/40 dark:text-white/40" />
            </div>
          ) : gmailEmails.length > 0 ? (
            <div className="flex flex-col gap-3">
              {gmailEmails.map((email: any) => (
                <div key={email.id} className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 flex flex-col gap-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[0.8125rem] font-bold text-black/90 dark:text-white/90 line-clamp-1">{email.from}</span>
                  </div>
                  <span className="text-[0.875rem] font-semibold text-black/80 dark:text-white/80 line-clamp-1">{email.subject}</span>
                  <span className="text-[0.8125rem] text-black/50 dark:text-white/50 line-clamp-2 mt-1 leading-snug">{email.snippet}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-5 text-sm font-medium text-black/50 dark:text-white/50 text-center">
              Son e-posta bulunamadı.
            </div>
          )
        ) : (
          <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-5 text-sm font-medium text-black/50 dark:text-white/50 text-center">
            Gelen son e-postalarınızı görmek için Gmail'e bağlanın.
          </div>
        )}
      </div>
`;

code = code.replace(aiRegex, gmailContent.trim());

// We need to enclose each block in a transparent placeholder (glass container)
// "bir şeffaf placeholder içerisinde olsun"
// I will wrap the lists of tasks inside <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-5">
const focusRegex = /<div className="flex flex-col gap-4">\s*<AnimatePresence mode="popLayout">[\s\S]*?<\/AnimatePresence>\s*\{focusTasks\.length === 0 && <span className="text-black\/30 dark:text-white\/30 text-sm font-medium">Odak belirlenmedi<\/span>\}\s*<\/div>/;

const programRegex = /<div className="flex flex-col gap-4">\s*<AnimatePresence mode="popLayout">[\s\S]*?<\/AnimatePresence>\s*\{programTasks\.length === 0 && <span className="text-black\/30 dark:text-white\/30 text-sm font-medium">Program boş<\/span>\}\s*<\/div>/;

const freeRegex = /<div className="flex flex-col gap-3">\s*<AnimatePresence mode="popLayout">[\s\S]*?<\/AnimatePresence>\s*\{freeTasks\.length === 0 && <span className="text-black\/30 dark:text-white\/30 text-sm font-medium">Serbest görev yok<\/span>\}\s*<\/div>/;

code = code.replace(focusRegex, (match) => {
  return `<div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-5">\n          ${match}\n        </div>`;
});

code = code.replace(programRegex, (match) => {
  return `<div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-5">\n          ${match}\n        </div>`;
});

code = code.replace(freeRegex, (match) => {
  return `<div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-5">\n          ${match}\n        </div>`;
});

const aklmdaRegex = /<div \s*onClick=\{\(\) => \{ triggerHaptic\('light'\); setView\('inbox'\); \}\}\s*className="flex items-center gap-3 cursor-pointer group bg-black\/5 dark:bg-white\/5 p-4 rounded-2xl hover:bg-black\/10 dark:hover:bg-white\/10 transition-colors"\s*>[\s\S]*?<\/div>/;

code = code.replace(aklmdaRegex, (match) => {
  return `<div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-5">\n          ${match}\n        </div>`;
});

fs.writeFileSync('src/App.tsx', code);
console.log("Updated TodayView successfully.");
