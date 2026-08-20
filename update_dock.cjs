const fs = require('fs');
let code = fs.readFileSync('src/components/MobileDock.tsx', 'utf8');

// Replace settings with profile icon
code = code.replace(/Settings,/g, "Settings, User,");
code = code.replace(/{ id: 'settings', icon: Settings, color: \[142, 142, 147\], isAction: true }/g, "{ id: 'profile', icon: User, color: [142, 142, 147], isAction: true }");
code = code.replace(/tab.id === 'settings'/g, "tab.id === 'profile'");
code = code.replace(/setIsSettingsOpen\(true\)/g, "setIsSettingsOpen(true)"); // same

// Remove Kanvas from tabs
code = code.replace(/\{ id: 'kanvas', icon: LayoutDashboard, color: \[255, 159, 10\], isAction: false \},\n/g, "");

// DOCK_WIDTH is 340 for 6 items. Now 5 items.
code = code.replace(/const DOCK_WIDTH = 340;/g, "const DOCK_WIDTH = 285;");
code = code.replace(/Math.min\(5,/g, "Math.min(4,");
code = code.replace(/w-\[340px\]/g, "w-[285px]");

fs.writeFileSync('src/components/MobileDock.tsx', code);
