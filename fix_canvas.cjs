const fs = require('fs');
let code = fs.readFileSync('src/components/CanvasView.tsx', 'utf8');
code = code.replace('if (onChangeType) onChangeType(id, k);', 'if (typeof onChangeType === "function") onChangeType(id, k);');
fs.writeFileSync('src/components/CanvasView.tsx', code);
