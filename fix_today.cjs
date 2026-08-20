const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<div className="flex flex-col mb-10 md:mb-16">([\s\S]*?)<\/h1>\s*<\/div>\s*<div className="flex flex-col">([\s\S]*?)<\/div>\s*<\/div>/;

code = code.replace(regex, (match, h1Block, densityBlock) => {
  return `<div className="flex flex-col mb-10 md:mb-16 gap-3">
        <div className="flex flex-col items-start gap-2">
          <h1 className={\`text-3xl md:text-4xl font-bold tracking-tight uppercase flex flex-col md:flex-row md:items-center gap-2 md:gap-3 transition-colors \${weather ? (weather.isDay ? "text-[#1a1a1a] drop-shadow-md" : "text-white drop-shadow-md") : "text-black dark:text-white"}\`}>
            <span>{dayNum} {monthName}</span>
            {!weather ? (
              <button 
                onClick={() => fetchWeather()}
                disabled={weatherLoading}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-black/40 dark:text-white/40 hover:text-black hover:bg-black/10 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
                title="Hava Durumu"
              >
                {weatherLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              </button>
            ) : (
              <div className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md self-start md:self-auto \${weather.isDay ? "bg-white/30" : "bg-black/30"}\`}>
                {(() => {
                  const Icon = getWeatherConfig(weather.code, weather.isDay).icon;
                  return <Icon className={\`w-4 h-4 \${weather.isDay ? "text-black/80" : "text-white/90"}\`} />;
                })()}
                <span className={\`text-sm font-bold \${weather.isDay ? "text-black/80" : "text-white/90"}\`}>{weather.temp}°</span>
              </div>
            )}
          </h1>
          <div className="flex flex-col scale-90 origin-left md:scale-100 mt-1 md:mt-2">
            ${densityBlock}
          </div>
        </div>
      </div>`;
});

fs.writeFileSync('src/App.tsx', code);
