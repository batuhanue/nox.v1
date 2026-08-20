const fs = require('fs');
let code = fs.readFileSync('src/components/WeatherBackground.tsx', 'utf8');

if (!code.includes('console.log("WeatherBackground rendering"')) {
  code = code.replace(
    'export function WeatherBackground({ weatherCode, isDay }: { weatherCode: number, isDay: number }) {',
    'export function WeatherBackground({ weatherCode, isDay }: { weatherCode: number, isDay: number }) {\n  console.log("WeatherBackground rendering", { weatherCode, isDay });'
  );
  fs.writeFileSync('src/components/WeatherBackground.tsx', code);
}
