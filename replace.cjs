const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/bg-black/g, 'bg-brand-bg');
content = content.replace(/text-white/g, 'text-brand-fg');
content = content.replace(/border-white/g, 'border-brand-fg');
content = content.replace(/bg-white/g, 'bg-brand-fg');
content = content.replace(/hover:bg-white/g, 'hover:bg-brand-fg');
content = content.replace(/hover:text-black/g, 'hover:text-brand-bg');
content = content.replace(/bg-\[#1a1a1a\]/g, 'bg-brand-bg');

// Remove static styling from App.tsx root divs since they now use css variables?
// Or leave them, we've replaced bg-black with bg-brand-bg.

fs.writeFileSync('src/App.tsx', content);

let cssContent = fs.readFileSync('src/index.css', 'utf8');
if (!cssContent.includes('--color-brand-bg')) {
  cssContent = cssContent.replace('@theme {', '@theme {\n  --color-brand-bg: var(--bg-color, #000000);\n  --color-brand-fg: var(--theme-color, #ffffff);\n');
  cssContent = cssContent.replace(':root {', ':root {\n  --bg-color: #000000;\n  --theme-color: #ffffff;\n');
  cssContent = cssContent.replace(/background-color: #000;/g, 'background-color: var(--color-brand-bg);');
  cssContent = cssContent.replace(/color: #fff;/g, 'color: var(--color-brand-fg);');
  fs.writeFileSync('src/index.css', cssContent);
}
console.log('Replaced successfully.');
