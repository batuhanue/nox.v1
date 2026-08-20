import React, { useEffect, useRef, useState } from 'react';
import { Inbox, ListTodo, Calendar as CalendarIcon, LayoutDashboard, Plus, Settings, User } from 'lucide-react';
import { triggerHaptic } from '../App';

const TABS = [
  { id: 'inbox', icon: Inbox, color: [94, 92, 230], isAction: false },
  { id: 'today', icon: ListTodo, color: [10, 132, 255], isAction: false },
  { id: 'add', icon: Plus, color: [52, 199, 89], isAction: true },
  { id: 'calendar', icon: CalendarIcon, color: [255, 105, 97], isAction: false },
  { id: 'profile', icon: User, color: [142, 142, 147], isAction: true }
];
const TABW = 55;
const DOCK_WIDTH = 285; // 5 * 55 + 10 padding

export function MobileDock({ view, setView, setIsAdding, setIsSettingsOpen }: { view: string; setView: (v: any) => void; setIsAdding: (v: boolean) => void; setIsSettingsOpen: (v: boolean) => void }) {
  const [animState, setAnimState] = useState({ x: TABW, dx: TABW, v: 0, i: 1 });
  const dockRef = useRef<HTMLDivElement>(null);

  // Use refs for mutable values that shouldn't trigger re-renders directly inside RAF
  const stateRef = useRef({ x: TABW, v: 0, d: TABW, dvel: 0, target: TABW, i: 1, settled: true, dragging: false, held: false, initialDragI: -1 });

  // Sync prop changes
  useEffect(() => {
    const idx = TABS.findIndex((t) => t.id === view);
    if (idx >= 0 && idx !== stateRef.current.i) {
      select(idx, true);
    }
  }, [view]);

  const select = (i: number, fromProp = false, isTap = false) => {
    const tab = TABS[i];
    const s = stateRef.current;
    
    // Actions are only triggered on tap, not during swipe/drag sliding
    if (tab.isAction) {
       if (isTap) {
         triggerHaptic('heavy');
         if (tab.id === 'add') setIsAdding(true);
         if (tab.id === 'profile') setIsSettingsOpen(true);
       }
       return;
    }

    if (i === s.i) {
      if (isTap) {
        s.v += 1.6;
        s.dvel -= 1.2;
        s.settled = false;
      }
      return;
    }
    if (!fromProp) {
      triggerHaptic('heavy');
      setView(tab.id);
    }
    s.target = i * TABW;
    s.i = i;
    s.settled = false;
    setAnimState((prev) => ({ ...prev, i }));
  };

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const s = stateRef.current;
      const k = 0.155, damp = 0.855, k2 = 0.055, damp2 = 0.885;
      s.v = (s.v + (s.target - s.x) * k) * damp;
      s.x += s.v;
      s.dvel = (s.dvel + (s.target - s.d) * k2) * damp2;
      s.d += s.dvel;

      const moving = Math.abs(s.target - s.x) > 0.1 || Math.abs(s.v) > 0.05 || Math.abs(s.target - s.d) > 0.1;
      if (moving || !s.settled) {
        s.settled = !moving;
        setAnimState({ x: s.x, dx: s.d, v: s.v, i: s.i });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const idxFromClientX = (cx: number) => {
    const el = dockRef.current;
    if (!el) return stateRef.current.i;
    const r = el.getBoundingClientRect();
    const scale = r.width / DOCK_WIDTH;
    const local = (cx - r.left) / scale - 5 - TABW / 2;
    return Math.max(0, Math.min(4, Math.round(local / TABW)));
  };

  const handleDown = (e: React.MouseEvent | React.TouchEvent) => {
    const s = stateRef.current;
    s.dragging = true;
    s.settled = false;
    s.held = true;
    setAnimState((prev) => ({ ...prev }));
    
    const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const newI = idxFromClientX(cx);
    s.initialDragI = newI;
    
    // If it's an action, we select it as a tap. Otherwise, just select it normally.
    select(newI, false, true);

    const onMove = (me: MouseEvent | TouchEvent) => {
      if (!stateRef.current.dragging) return;
      if (me.cancelable) me.preventDefault();
      const mcx = 'touches' in me ? me.touches[0].clientX : (me as MouseEvent).clientX;
      const mi = idxFromClientX(mcx);
      
      // During a swipe drag, if we slide over an action, we ignore it and keep the previous view
      if (mi !== stateRef.current.i && !TABS[mi].isAction) {
        select(mi, false, false);
      }
    };

    const onUp = () => {
      stateRef.current.dragging = false;
      stateRef.current.settled = false;
      stateRef.current.held = false;
      setAnimState((prev) => ({ ...prev }));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  };

  const s = animState;
  const tab = TABS[s.i] || TABS[1];
  const gap = s.x - s.dx;
  // Reduced jelly effect: stretched and speed multipliers are halved
  const stretch = Math.min(Math.abs(gap) / 34, 1);
  const speed = Math.min(Math.abs(s.v) / 11, 1);
  const wobble = Math.min(Math.abs(s.v) / 9, 1);
  const [r, g, b] = tab.color;

  const pillX = (s.x + 10).toFixed(2);
  const pillSX = (1 + stretch * 0.45 + (stateRef.current.held ? 0.05 : 0)).toFixed(3);
  const pillSY = (1 - speed * 0.12 + stretch * 0.015 - (stateRef.current.held ? 0.04 : 0)).toFixed(3);
  const dropX = (s.dx + 20.5).toFixed(2);
  const dropS = (0.5 + stretch * 0.6).toFixed(3);
  const glowLeft = (s.x - 30).toFixed(1); // adjusted for new pill size
  const glowBg = `radial-gradient(closest-side, rgba(${r},${g},${b},${(0.25 + speed * 0.2).toFixed(2)}), transparent 72%)`;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[285px] h-[66px] z-[60] md:hidden">
      {/* Filters */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="dock-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b"></feGaussianBlur>
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8.5" result="g"></feColorMatrix>
            <feBlend in="SourceGraphic" in2="g"></feBlend>
          </filter>
        </defs>
      </svg>

      {/* Dock Background */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 33, overflow: 'hidden',
        backdropFilter: 'blur(22px) saturate(190%) brightness(1.06)',
        WebkitBackdropFilter: 'blur(22px) saturate(190%) brightness(1.06)',
        background: 'rgba(255,255,255,0.42)',
        boxShadow: '0 18px 34px -14px rgba(0,0,0,0.30), 0 2px 6px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(255,255,255,0.55)'
      }}>
        <div style={{
          position: 'absolute', inset: '-40px', opacity: 0.85, filter: 'blur(20px)',
          transition: 'none', left: glowLeft + 'px', width: 140, right: 'auto', top: -30, bottom: -30,
          background: glowBg
        }}></div>
        <div style={{ position: 'absolute', inset: 0, filter: 'url(#dock-goo)' }}>
          <div style={{
            position: 'absolute', top: 10.5, left: 0, width: 45, height: 45, borderRadius: 22.5,
            background: 'rgba(255,255,255,0.94)',
            transform: `translateX(${pillX}px) scaleX(${pillSX}) scaleY(${pillSY})`,
            transformOrigin: 'center'
          }}></div>
          <div style={{
            position: 'absolute', top: 21, left: 0, width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(255,255,255,0.94)',
            transform: `translateX(${dropX}px) scale(${dropS})`,
            transformOrigin: 'center'
          }}></div>
        </div>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 33, boxShadow: '0 1px 0 rgba(255,255,255,.9) inset,0 -1px 1px rgba(0,0,0,.05) inset', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', borderRadius: '33px 33px 40% 40%/33px 33px 100% 100%', background: 'linear-gradient(to bottom,rgba(255,255,255,.55),transparent)', pointerEvents: 'none' }}></div>
      </div>

      {/* Interactive Icons Layer */}
      <div 
        ref={dockRef} 
        onMouseDown={handleDown} 
        onTouchStart={handleDown} 
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 5px', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {TABS.map((t, n) => {
          const isActive = n === s.i;
          const isAction = t.isAction;
          
          let color = "rgba(60,60,67,0.55)";
          let scale = (1).toFixed(3);
          
          if (isActive) {
             color = `rgb(${t.color[0]},${t.color[1]},${t.color[2]})`;
             scale = (1.1 - wobble * 0.14).toFixed(3);
          } else if (isAction) {
             // Let action buttons have a slight neutral tint or just stay gray
             color = "rgba(60,60,67,0.7)";
          }

          const Icon = t.icon;
          return (
            <div 
              key={t.id}
              style={{
                width: TABW, height: 66, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative', color,
                transform: `scale(${scale})`, transition: 'color 0.15s ease'
              }}
            >
              <Icon className="w-[1.4rem] h-[1.4rem]" strokeWidth={isActive ? 2.5 : (isAction ? 2.5 : 2)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
