import React, { useMemo, useEffect, useState } from 'react';

const P = {
  sabah: {
    sky: 'linear-gradient(180deg,#ffd9a8 0%,#ffc98f 14%,#a8d8f0 52%,#cfeaf6 100%)',
    glow: 'radial-gradient(circle at 78% 20%, rgba(255,214,150,.85), rgba(255,214,150,0) 62%)',
    sun: { x: '76%', y: '92px', size: 108, core: '#fff3d0', halo: 'rgba(255,205,130,.55)' },
    far: 'linear-gradient(180deg,#9fc4d8,#b8d6e4)', water: 'linear-gradient(180deg,#8fc7dd,#6fb2cf)',
    mid: 'linear-gradient(180deg,#7fb8a0,#5f9d86)', ground: 'linear-gradient(180deg,#8dc48f,#5f9c6c)',
    cloudColor: 'rgba(255,255,255,.9)', clouds: 3, birds: true, stars: false, rain: false, snow: false, fog: false,
    outfit: 'light', arm: 'rest'
  },
  sicak: {
    sky: 'linear-gradient(180deg,#3d9fe0 0%,#67bde9 40%,#a8dcf0 78%,#d6eef7 100%)',
    glow: 'radial-gradient(circle at 84% 12%, rgba(255,244,200,.9), rgba(255,244,200,0) 58%)',
    sun: { x: '82%', y: '54px', size: 128, core: '#fffbe6', halo: 'rgba(255,238,168,.6)' },
    far: 'linear-gradient(180deg,#6cb8dc,#8ecbe4)', water: 'linear-gradient(180deg,#63b7d8,#3f9dc6)',
    mid: 'linear-gradient(180deg,#63b394,#3f9a7c)', ground: 'linear-gradient(180deg,#7cc07f,#4e9a5f)',
    cloudColor: 'rgba(255,255,255,.85)', clouds: 2, birds: true, stars: false, rain: false, snow: false, fog: false,
    outfit: 'light', arm: 'wipe'
  },
  aksam: {
    sky: 'linear-gradient(180deg,#4a4f8f 0%,#a5619a 32%,#ec8b6a 62%,#ffc98a 100%)',
    glow: 'radial-gradient(circle at 26% 46%, rgba(255,170,110,.9), rgba(255,150,90,0) 60%)',
    sun: { x: '22%', y: '250px', size: 140, core: '#ffe0a6', halo: 'rgba(255,150,95,.55)' },
    far: 'linear-gradient(180deg,#7a6b93,#94789c)', water: 'linear-gradient(180deg,#c78a86,#8a6f95)',
    mid: 'linear-gradient(180deg,#5e5878,#43405c)', ground: 'linear-gradient(180deg,#5d6a63,#3c4a48)',
    cloudColor: 'rgba(255,196,160,.7)', clouds: 3, birds: true, stars: false, rain: false, snow: false, fog: false,
    outfit: 'light', arm: 'rest'
  },
  gece: {
    sky: 'linear-gradient(180deg,#080f22 0%,#12234a 42%,#1d3a63 74%,#2b5175 100%)',
    glow: 'radial-gradient(circle at 70% 16%, rgba(150,190,255,.35), rgba(150,190,255,0) 60%)',
    sun: { x: '72%', y: '76px', size: 86, core: '#eef3ff', halo: 'rgba(180,205,255,.35)' },
    far: 'linear-gradient(180deg,#1b3352,#26456a)', water: 'linear-gradient(180deg,#22456b,#14304f)',
    mid: 'linear-gradient(180deg,#16283c,#0e1c2b)', ground: 'linear-gradient(180deg,#162c2a,#0c1a1c)',
    cloudColor: 'rgba(140,170,210,.28)', clouds: 2, birds: false, stars: true, rain: false, snow: false, fog: false,
    outfit: 'night', arm: 'rest'
  },
  yagmur: {
    sky: 'linear-gradient(180deg,#5b6a78 0%,#7b8b98 44%,#a3b1bb 80%,#c3cdd4 100%)',
    glow: 'radial-gradient(circle at 60% 24%, rgba(255,255,255,.24), rgba(255,255,255,0) 58%)',
    sun: null,
    far: 'linear-gradient(180deg,#8b9aa5,#9fadb6)', water: 'linear-gradient(180deg,#7d939e,#5d7583)',
    mid: 'linear-gradient(180deg,#5e7a72,#456058)', ground: 'linear-gradient(180deg,#5f8168,#41604c)',
    cloudColor: 'rgba(232,238,242,.75)', clouds: 5, birds: false, stars: false, rain: true, snow: false, fog: false,
    outfit: 'rain', arm: 'umbrella'
  },
  kar: {
    sky: 'linear-gradient(180deg,#8f9fb0 0%,#b4c2ce 46%,#d7e0e7 82%,#eef3f6 100%)',
    glow: 'radial-gradient(circle at 50% 18%, rgba(255,255,255,.4), rgba(255,255,255,0) 60%)',
    sun: null,
    far: 'linear-gradient(180deg,#c3d1dc,#d9e4ea)', water: 'linear-gradient(180deg,#b9ccd6,#9cb3c0)',
    mid: 'linear-gradient(180deg,#e6eef3,#cad8e0)', ground: 'linear-gradient(180deg,#f6fafc,#dbe6ec)',
    cloudColor: 'rgba(255,255,255,.85)', clouds: 4, birds: false, stars: false, rain: false, snow: true, fog: true,
    outfit: 'snow', arm: 'hug'
  },
  bulutlu: {
    sky: 'linear-gradient(180deg,#8ba0b0 0%,#a9bbc7 44%,#c8d5dd 80%,#e2eaef 100%)',
    glow: 'radial-gradient(circle at 40% 22%, rgba(255,255,255,.3), rgba(255,255,255,0) 60%)',
    sun: { x: '66%', y: '86px', size: 100, core: 'rgba(255,250,235,.55)', halo: 'rgba(255,250,235,.22)' },
    far: 'linear-gradient(180deg,#9db0bc,#b2c3cd)', water: 'linear-gradient(180deg,#93aab7,#75909f)',
    mid: 'linear-gradient(180deg,#6d9083,#527469)', ground: 'linear-gradient(180deg,#7fa87f,#5b8563)',
    cloudColor: 'rgba(248,251,253,.82)', clouds: 6, birds: false, stars: false, rain: false, snow: false, fog: false,
    outfit: 'light', arm: 'rest'
  }
};

const OUTFIT = {
  light: { shirt: '#f3a83c', shirtDark: '#dd8f24', pants: '#5b8fc7', pantsDark: '#4a79ac', skin: '#f0b184', hair: '#2c2118', cap: '#7fa6c9', capBand: '#5f86ab', shoe: '#e9e2d6', accent: '#f3a83c', cap_on: true },
  night: { shirt: '#4f5f7a', shirtDark: '#3e4c63', pants: '#33405a', pantsDark: '#28334a', skin: '#e6a87e', hair: '#241b14', cap: '#3c4a63', capBand: '#2f3b50', shoe: '#8f9aa8', accent: '#7d93b5', cap_on: false },
  rain: { shirt: '#3f6f8f', shirtDark: '#335b78', pants: '#2f4a5c', pantsDark: '#26404f', skin: '#eeaf82', hair: '#2c2118', cap: '#3f6f8f', capBand: '#335b78', shoe: '#2c3b45', accent: '#e2604f', cap_on: false },
  snow: { shirt: '#d8543f', shirtDark: '#bd4634', pants: '#3b4a5c', pantsDark: '#2f3c4c', skin: '#f0b184', hair: '#2c2118', cap: '#efe6d8', capBand: '#c9bca9', shoe: '#3b3229', accent: '#efc94c', cap_on: false }
};

const ARM = {
  rest: { transformOrigin: '114px 176px', animation: 'breathe 5s ease-in-out infinite' },
  wipe: { transformOrigin: '114px 176px', animation: 'wipe 4.6s ease-in-out infinite' },
  shade: { transformOrigin: '114px 176px', animation: 'shade 4s ease-in-out infinite' },
  umbrella: { transformOrigin: '114px 176px', transform: 'rotate(-108deg)' },
  hug: { transformOrigin: '114px 176px', animation: 'hug 3.6s ease-in-out infinite' }
};

const rnd = (i: number, m: number) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * m;

export function WeatherBackground({ weatherCode, isDay }: { weatherCode: number, isDay: number }) {
  const [hour, setHour] = useState(new Date().getHours());

  useEffect(() => {
    const interval = setInterval(() => setHour(new Date().getHours()), 60000);
    return () => clearInterval(interval);
  }, []);

  let weatherKey: keyof typeof P = 'sicak';
  if (weatherCode === 0 || weatherCode === 1) {
    if (isDay === 0) weatherKey = 'gece';
    else if (hour < 10) weatherKey = 'sabah';
    else if (hour >= 17 && hour < 20) weatherKey = 'aksam';
    else weatherKey = 'sicak';
  } else if (weatherCode === 2 || weatherCode === 3) {
    weatherKey = (isDay === 0) ? 'gece' : 'bulutlu';
  } else if ((weatherCode >= 50 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82) || weatherCode >= 95) {
    weatherKey = 'yagmur';
  } else if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) {
    weatherKey = 'kar';
  } else {
    weatherKey = isDay === 0 ? 'gece' : 'bulutlu';
  }

  const p = P[weatherKey];
  const o = OUTFIT[p.outfit as keyof typeof OUTFIT];
  const armStyle = ARM[p.arm as keyof typeof ARM];

  const transStyle = { transition: 'background 1.5s ease-in-out, fill 1.5s ease-in-out, opacity 1.5s ease-in-out' };

  const clouds = useMemo(() => {
    return Array.from({ length: p.clouds }, (_, i) => {
      const top = 10 + rnd(i + 1, 120), s = 0.6 + rnd(i + 7, 0.8), dur = 60 + rnd(i + 3, 70);
      const puff = (w: number, hh: number, l: number, t: number) => ({
        position: 'absolute' as const, left: l, top: t, width: w, height: hh, 
        borderRadius: 999, background: p.cloudColor, 
        filter: `blur(${weatherKey === 'kar' || weatherKey === 'yagmur' ? 6 : 3}px)`,
        ...transStyle
      });
      return {
        style: {
          position: 'absolute' as const, top: top, left: 0, width: 300, height: 100, 
          transform: `scale(${s.toFixed(2)})`, animation: `drift ${dur.toFixed(0)}s linear infinite`, 
          animationDelay: `-${(rnd(i + 5, dur)).toFixed(0)}s`, opacity: (0.28 + rnd(i + 11, 0.3)).toFixed(2)
        },
        puffA: puff(190, 54, 40, 34), puffB: puff(120, 96, 96, 8), puffC: puff(140, 46, 140, 44)
      };
    });
  }, [p.clouds, p.cloudColor, weatherKey]);

  const drops = useMemo(() => {
    if (!p.rain) return [];
    return Array.from({ length: 90 }, (_, i) => ({
      position: 'absolute' as const, top: 0, left: `${(rnd(i + 2, 100)).toFixed(1)}%`,
      width: '1.6px', height: `${(14 + rnd(i + 9, 22)).toFixed(0)}px`, borderRadius: '2px',
      background: 'linear-gradient(180deg,rgba(255,255,255,0),rgba(226,240,248,.85))',
      animation: `rainfall ${(0.55 + rnd(i + 4, 0.5)).toFixed(2)}s linear infinite`,
      animationDelay: `-${(rnd(i + 6, 1.2)).toFixed(2)}s`, opacity: 0.7
    }));
  }, [p.rain]);

  const flakes = useMemo(() => {
    if (!p.snow) return [];
    return Array.from({ length: 70 }, (_, i) => {
      const d = 3 + rnd(i + 3, 5);
      return { 
        position: 'absolute' as const, top: 0, left: `${(rnd(i + 5, 100)).toFixed(1)}%`,
        width: `${d.toFixed(1)}px`, height: `${d.toFixed(1)}px`, borderRadius: 999,
        background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,.7)',
        animation: `snowfall ${(6 + rnd(i + 8, 7)).toFixed(1)}s linear infinite`,
        animationDelay: `-${(rnd(i + 2, 9)).toFixed(1)}s`, opacity: (0.6 + rnd(i + 12, 0.4)).toFixed(2)
      };
    });
  }, [p.snow]);

  const stars = useMemo(() => {
    if (!p.stars) return [];
    return Array.from({ length: 60 }, (_, i) => {
      const d = 1.2 + rnd(i + 4, 2);
      return { 
        position: 'absolute' as const, left: `${(rnd(i + 1, 100)).toFixed(1)}%`, top: `${(rnd(i + 6, 62)).toFixed(1)}%`,
        width: `${d.toFixed(1)}px`, height: `${d.toFixed(1)}px`, borderRadius: 999, background: '#fff',
        animation: `twinkle ${(2 + rnd(i + 9, 4)).toFixed(1)}s ease-in-out infinite`,
        animationDelay: `-${(rnd(i + 3, 5)).toFixed(1)}s` 
      };
    });
  }, [p.stars]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: p.sky, ...transStyle }} />
      <div style={{ position: 'absolute', inset: 0, background: p.glow, ...transStyle }} />
      
      {p.stars && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {stars.map((s, i) => <div key={i} style={s} />)}
        </div>
      )}

      {p.sun && (
        <div style={{ position: 'absolute', left: p.sun.x, top: p.sun.y, width: p.sun.size, height: p.sun.size, animation: 'bob 9s ease-in-out infinite', ...transStyle }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 999, background: p.sun.core, boxShadow: `0 0 60px 20px ${p.sun.halo}`, ...transStyle }} />
          <div style={{ position: 'absolute', inset: '-40%', borderRadius: 999, background: `radial-gradient(circle,${p.sun.halo},transparent 70%)`, animation: 'sunPulse 6s ease-in-out infinite', ...transStyle }} />
        </div>
      )}

      {clouds.map((c, i) => (
        <div key={i} style={c.style}>
          <div style={c.puffA} />
          <div style={c.puffB} />
          <div style={c.puffC} />
        </div>
      ))}

      {p.birds && (
        <div style={{ position: 'absolute', top: 120, left: 0, width: 60, height: 30, animation: 'birdfly 26s linear infinite', opacity: 0.35 }}>
          <svg viewBox="0 0 60 30" width="60" height="30">
            <path d="M2 14q7-9 13 0q6-9 13 0" fill="none" stroke="#20303c" strokeWidth="2" strokeLinecap="round" />
            <path d="M30 22q5-6 9 0q5-6 9 0" fill="none" stroke="#20303c" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* Mountains & Ground */}
      <div style={{ position: 'absolute', left: '-4%', right: '-4%', top: '34%', height: 'clamp(70px,16%,130px)', background: p.far, borderRadius: '60% 40% 0 0/100% 90% 0 0', filter: 'blur(1.5px)', opacity: 0.9, ...transStyle }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: '40%', height: '14%', background: p.water, ...transStyle }}>
         <div style={{ position: 'absolute', left: '-10%', right: '-10%', top: '14px', height: '60%', background: 'repeating-linear-gradient(180deg,rgba(255,255,255,.16) 0 2px,rgba(255,255,255,0) 2px 12px)', animation: 'wave 9s ease-in-out infinite' }} />
      </div>
      <div style={{ position: 'absolute', left: '-8%', right: '-8%', top: '46%', height: 'clamp(66px,15%,120px)', background: p.mid, borderRadius: '50% 60% 0 0/100% 100% 0 0', filter: 'blur(.6px)', opacity: 0.95, ...transStyle }} />
      
      <div style={{ position: 'absolute', left: '-6%', right: '-6%', top: '54%', bottom: '-40px', background: p.ground, borderRadius: '44% 56% 0 0/70px 70px 0 0', ...transStyle }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '26px', background: 'repeating-linear-gradient(92deg,rgba(255,255,255,.10) 0 3px,rgba(0,0,0,.06) 3px 7px)', animation: 'grasswave 7s ease-in-out infinite', transformOrigin: 'bottom center' }} />
      </div>

      {/* Particles */}
      {p.rain && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {drops.map((d, i) => <div key={i} style={d} />)}
        </div>
      )}
      {p.snow && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {flakes.map((f, i) => <div key={i} style={f} />)}
        </div>
      )}
      {p.fog && (
        <div style={{ position: 'absolute', left: '-10%', right: '-10%', bottom: '18%', height: '38%', background: 'linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.62))', filter: 'blur(14px)', animation: 'wave 22s ease-in-out infinite' }} />
      )}

      {/* Bottom Fade Mask to blend with the white/dark app background */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%', pointerEvents: 'none', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', maskImage: 'linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.6) 45%,#000 100%)', WebkitMaskImage: 'linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.6) 45%,#000 100%)' }} />
      <div className="bg-gradient-to-t from-[#f4f4f4] dark:from-[#121212] to-transparent" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%', pointerEvents: 'none', opacity: 1 }} />
    </div>
  );
}
