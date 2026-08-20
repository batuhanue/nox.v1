const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { EmailDetailModal }")) {
  code = "import { EmailDetailModal } from './components/EmailDetailModal';\n" + code;
}

fs.writeFileSync('src/App.tsx', code);
console.log("Fixed App.tsx imports.");
