const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = '<div className="fixed inset-0 w-screen h-screen bg-red-500 pointer-events-none" style={{ zIndex: 0 }}><WeatherBackground weatherCode={weather.code} isDay={weather.isDay} /></div>';
const replacement1 = '<div className="fixed inset-0 w-screen h-screen pointer-events-none" style={{ zIndex: 0 }}><WeatherBackground weatherCode={weather.code} isDay={weather.isDay} /></div>';
code = code.replace(target1, replacement1);

fs.writeFileSync('src/App.tsx', code);
