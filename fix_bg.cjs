const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = '<div className="fixed inset-0 w-screen h-screen z-[-1] pointer-events-none"><WeatherBackground weatherCode={weather.code} isDay={weather.isDay} /></div>';
const replacement1 = '<div className="fixed inset-0 w-screen h-screen pointer-events-none" style={{ zIndex: 0 }}><WeatherBackground weatherCode={weather.code} isDay={weather.isDay} /></div>';
code = code.replace(target1, replacement1);

const target2 = '<div className="w-full max-w-5xl mx-auto min-h-screen flex flex-col relative">';
const replacement2 = '<div className="w-full max-w-5xl mx-auto min-h-screen flex flex-col relative" style={{ zIndex: 10 }}>';
code = code.replace(target2, replacement2);

fs.writeFileSync('src/App.tsx', code);
