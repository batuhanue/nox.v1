const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Change accessToken state to not use localStorage initially (we will get it from Firestore)
code = code.replace(
  "const [accessToken, setAccessToken] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('google_calendar_token') : null);",
  "const [accessToken, setAccessToken] = useState<string | null>(null);"
);

// 2. Modify handleGoogleError
code = code.replace(
  "setAccessToken(null);\n      localStorage.removeItem('google_calendar_token');",
  "setAccessToken(null);\n      if (user) {\n        setDoc(doc(db, 'users', user.uid), { googleCalendarToken: null }, { merge: true });\n      }"
);

// 3. Modify handleLogin
code = code.replace(
  "setAccessToken(credential.accessToken);\n        localStorage.setItem('google_calendar_token', credential.accessToken);",
  "setAccessToken(credential.accessToken);\n        if (auth.currentUser) {\n          setDoc(doc(db, 'users', auth.currentUser.uid), { googleCalendarToken: credential.accessToken }, { merge: true });\n        }"
);

// 4. Update fetchWeather to support parameters and save to Firestore
const fetchWeatherOld = `  const fetchWeather = () => {
      if (!navigator.geolocation) {
        alert("Tarayıcınız konum özelliğini desteklemiyor.");
        return;
      }
      setWeatherLoading(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
         const lat = pos.coords.latitude;
         const lon = pos.coords.longitude;
         try {
           const res = await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lon}&current=temperature_2m,weather_code,is_day\`);
           const data = await res.json();
           setWeather({ 
              temp: Math.round(data.current.temperature_2m), 
              code: data.current.weather_code,
              isDay: data.current.is_day 
           });
         } catch (e) {
           console.error(e);
         } finally {
           setWeatherLoading(false);
         }
      }, (err) => {
         setWeatherLoading(false);
         console.error("Geolocation error:", err.message); alert("Konum alınamadı: " + err.message + "\\nLütfen tarayıcı/sistem ayarlarından konum izni verdiğinizden emin olun.");
      });
  };`;

const fetchWeatherNew = `  const fetchWeather = async (savedLat?: number, savedLon?: number) => {
      if (savedLat !== undefined && savedLon !== undefined) {
         setWeatherLoading(true);
         try {
           const res = await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${savedLat}&longitude=\${savedLon}&current=temperature_2m,weather_code,is_day\`);
           const data = await res.json();
           setWeather({ temp: Math.round(data.current.temperature_2m), code: data.current.weather_code, isDay: data.current.is_day });
         } catch (e) {
           console.error(e);
         } finally {
           setWeatherLoading(false);
         }
         return;
      }

      if (!navigator.geolocation) {
        alert("Tarayıcınız konum özelliğini desteklemiyor.");
        return;
      }
      setWeatherLoading(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
         const lat = pos.coords.latitude;
         const lon = pos.coords.longitude;
         try {
           const res = await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${lat}&longitude=\${lon}&current=temperature_2m,weather_code,is_day\`);
           const data = await res.json();
           setWeather({ temp: Math.round(data.current.temperature_2m), code: data.current.weather_code, isDay: data.current.is_day });
           if (user) {
             setDoc(doc(db, 'users', user.uid), { weatherLocation: { lat, lon } }, { merge: true });
           }
         } catch (e) {
           console.error(e);
         } finally {
           setWeatherLoading(false);
         }
      }, (err) => {
         setWeatherLoading(false);
         console.error("Geolocation error:", err.message); alert("Konum alınamadı: " + err.message + "\\nLütfen tarayıcı/sistem ayarlarından konum izni verdiğinizden emin olun.");
      });
  };`;

code = code.replace(fetchWeatherOld, fetchWeatherNew);

// 5. Add a useEffect to listen to users/user.uid
const fetchTasksEffectRegex = /\/\/ Fetch Tasks Effect\n  useEffect\(\(\) => {\n    if \(!user\) {[^]*?return unsubscribe;\n  }, \[user\]\);/m;
const match = code.match(fetchTasksEffectRegex);

if (match) {
  const newEffect = `// Fetch User Preferences Effect
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribePrefs = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.googleCalendarToken && data.googleCalendarToken !== accessToken) {
           setAccessToken(data.googleCalendarToken);
        }
        if (data.weatherLocation && data.weatherLocation.lat && data.weatherLocation.lon && !weather && !weatherLoading) {
           fetchWeather(data.weatherLocation.lat, data.weatherLocation.lon);
        }
      }
    });
    return unsubscribePrefs;
  }, [user, weather, weatherLoading, accessToken]);\n\n  ` + match[0];
  
  code = code.replace(match[0], newEffect);
} else {
  console.log("Could not find Fetch Tasks Effect");
}

fs.writeFileSync('src/App.tsx', code);
