const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { EmailDetailModal }")) {
  code = code.replace(
    "import { Plus, CheckCircle2, Circle, Clock, LayoutGrid, Calendar as CalendarIcon, Settings, AlignLeft, LogOut, Moon, Sun, Trash2, Check, ChevronLeft, CalendarPlus, MapPin, Search, ChevronRight, Activity, Cloud, Loader2 } from 'lucide-react';",
    "import { Plus, CheckCircle2, Circle, Clock, LayoutGrid, Calendar as CalendarIcon, Settings, AlignLeft, LogOut, Moon, Sun, Trash2, Check, ChevronLeft, CalendarPlus, MapPin, Search, ChevronRight, Activity, Cloud, Loader2 } from 'lucide-react';\nimport { EmailDetailModal } from './components/EmailDetailModal';"
  );
}

// Remove AiChat from WeeklyReviewView (line 972)
code = code.replace(/<AiChat isOpen=\{isAiChatOpen\} onClose=\{\(\) => setIsAiChatOpen\(false\)\} \/>/, '');

fs.writeFileSync('src/App.tsx', code);
console.log("Fixed App.tsx.");
