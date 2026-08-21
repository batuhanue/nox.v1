import { EmailDetailModal } from './components/EmailDetailModal';
import React, { useState, useEffect, useRef } from "react";
import { Plus, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock, MapPin, LogOut, Settings, Moon, Sun, Bot, MessageCircle, CloudRain, CloudSnow, CloudLightning, Cloud, Loader2, Inbox, LayoutDashboard, ListTodo , User as UserIcon, Mail } from "lucide-react";
import { mockTasks, mockSchedules } from "./data";
import { Task, DaySchedule } from "./types";
import { motion, AnimatePresence, useDragControls, useReducedMotion } from "motion/react";
import AddTaskModal from "./components/AddTaskModal";
import AiChat from "./components/AiChat";
import Markdown from 'react-markdown';
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";

import CanvasView from "./components/CanvasView";
import InboxView from "./components/InboxView";
import { syncGoogleCalendar, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from "./lib/googleCalendar";
import { handleFirebaseLogin, handleConnectCalendar, handleConnectGmail, normalizeOAuthError } from "./lib/googleOAuth";
import { WeatherBackground } from "./components/WeatherBackground";
import { MobileDock } from "./components/MobileDock";

export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning') => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(30);
        break;
      case 'heavy':
        navigator.vibrate(50);
        break;
      case 'success':
        navigator.vibrate([30, 60, 100]);
        break;
      case 'warning':
        navigator.vibrate([50, 50, 50]);
        break;
      default:
        navigator.vibrate(10);
    }
  }
};

const getLocalISODate = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function useTaskNotifications(tasks: Task[], user: User | null) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const subscribeToPush = async (userUid: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const registration = await navigator.serviceWorker.register('/custom-sw.js');
      console.log('Service Worker registered');
      
      const response = await fetch('/api/push/vapidPublicKey');
      const vapidPublicKey = await response.text();
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });
      
      await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userUid, subscription })
      });
    } catch (err) {
      console.error('Failed to subscribe to push', err);
    }
  };

  const syncTasksToBackend = async (userUid: string, currentTasks: Task[]) => {
    try {
      await fetch('/api/push/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userUid, tasks: currentTasks })
      });
    } catch (err) {
      console.error('Failed to sync tasks', err);
    }
  };

  const requestPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted' && user) {
        triggerHaptic('success');
        await subscribeToPush(user.uid);
        await syncTasksToBackend(user.uid, tasks);
      }
    }
  };

  // Setup Push on mount if permission granted
  useEffect(() => {
    if (permission === 'granted' && user) {
      subscribeToPush(user.uid);
    }
  }, [user, permission]);

  // Sync tasks whenever they change
  useEffect(() => {
    if (permission === 'granted' && user) {
      syncTasksToBackend(user.uid, tasks);
    }
  }, [tasks, user, permission]);

  return { permission, requestPermission };
}

const TaskCard: React.FC<{ task: Task, toggleTask: (id: string, current: boolean) => void, deleteTask: (id: string) => void, onTaskClick: (task: Task) => void }> = ({ task, toggleTask, deleteTask, onTaskClick }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className="relative"
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDrag={(event, info) => {
          const el = (event.target as HTMLElement).closest('.draggable-card') as HTMLElement;
          if (el) {
            const v = info.velocity.x;
            const ox = info.offset.x;
            const passedComplete = ox > 120 || (ox > 50 && v > 500);
            const passedDelete = ox < -120 || (ox < -50 && v < -500);
            const passed = passedComplete || passedDelete;

            const currentlyPassed = el.dataset.passed === 'true';

            if (passed && !currentlyPassed) {
              el.dataset.passed = 'true';
              triggerHaptic('medium');
            } else if (!passed && currentlyPassed) {
              el.dataset.passed = 'false';
              triggerHaptic('light');
            }

            const maxThreshold = 120;
            if (info.offset.x > 0) {
              // Swipe Right -> Complete
              const opacity = Math.min(info.offset.x / maxThreshold, 1) * 0.5;
              el.style.boxShadow = passedComplete ? `inset 0 0 40px rgba(16, 185, 129, 0.4), 0 0 20px rgba(16, 185, 129, 0.6)` : `inset 0 0 20px rgba(16, 185, 129, ${opacity})`;
              el.style.borderColor = `rgba(16, 185, 129, ${passedComplete ? 0.8 : opacity * 0.5})`;
            } else if (info.offset.x < 0) {
              // Swipe Left -> Delete
              const opacity = Math.min(-info.offset.x / maxThreshold, 1) * 0.5;
              el.style.boxShadow = passedDelete ? `inset 0 0 40px rgba(239, 68, 68, 0.4), 0 0 20px rgba(239, 68, 68, 0.6)` : `inset 0 0 20px rgba(239, 68, 68, ${opacity})`;
              el.style.borderColor = `rgba(239, 68, 68, ${passedDelete ? 0.8 : opacity * 0.5})`;
            }
          }
        }}
        onDragEnd={(event, info) => {
          const el = (event.target as HTMLElement).closest('.draggable-card') as HTMLElement;
          if (el) {
            el.style.boxShadow = '';
            el.style.borderColor = '';
            el.dataset.passed = 'false';
          }
          const v = info.velocity.x;
          const ox = info.offset.x;
          const passedComplete = ox > 120 || (ox > 50 && v > 300);
          const passedDelete = ox < -120 || (ox < -50 && v < -300);
          
          if (passedComplete) {
            triggerHaptic('success');
            toggleTask(task.id, !!task.completed);
          } else if (passedDelete) {
            triggerHaptic('warning');
            // Using setTimeout to let drag finish before removing element, avoiding React/Framer bugs
            setTimeout(() => {
              deleteTask(task.id);
            }, 0);
          }
        }}
        onClick={() => { triggerHaptic('light'); onTaskClick(task); }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className={`draggable-card rounded-[32px] p-6 relative overflow-hidden flex flex-col justify-between border-2 border-transparent ${task.completed ? 'opacity-50 grayscale' : ''}`}
        style={{ backgroundColor: task.color, minHeight: "150px", touchAction: "none", WebkitTapHighlightColor: "transparent" }}
      >
        <div className="flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-1.5">
            <h4 className={`text-[1.375rem] font-semibold text-black/90 leading-[1.1] whitespace-pre-line tracking-tight ${task.completed ? 'line-through' : ''}`}>
              {task.title}
            </h4>
            {/* Importance / Due Date Indicators */}
            {(task.importance === 'critical' || task.importance === 'important' || task.dueDate) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {task.importance === 'critical' && (
                  <span className="text-[0.625rem] font-bold px-2 py-0.5 rounded-sm bg-red-500/20 text-red-900 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                    Kritik
                  </span>
                )}
                {task.importance === 'important' && (
                  <span className="text-[0.625rem] font-bold px-2 py-0.5 rounded-sm bg-amber-500/20 text-amber-900 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                    Önemli
                  </span>
                )}
                {task.dueDate && (
                  <span className="text-[0.625rem] font-bold px-2 py-0.5 rounded-sm bg-black/10 text-black/70 uppercase tracking-widest flex items-center gap-1">
                    <CalendarIcon className="w-2.5 h-2.5" />
                    Bitiş: {task.dueDate}
                  </span>
                )}
                
      </div>
            )}
            
      </div>
          <div className="flex flex-col items-end shrink-0 ml-4">
            <div className="flex -space-x-2 shrink-0">
              {(task.attendees || []).map((a, i) => (
                <img
                  key={a.id}
                  src={a.avatarUrl}
                  alt="Attendee"
                  className="w-7 h-7 rounded-full border border-black/10"
                  style={{ zIndex: 10 - i }}
                />
              ))}
              
      </div>
            
      </div>
          
      </div>
        <div className="flex items-end justify-between mt-8 pointer-events-none">
          {task.isAllDay ? (
            <div>
              <div className="text-[0.8125rem] font-bold text-black/80 tracking-wide">Tüm Gün</div>
              <div className="text-[0.625rem] text-black/50 font-bold uppercase mt-1 tracking-wider">Planlandı</div>
              
      </div>
          ) : (
            <>
              <div>
                <div className="text-[0.8125rem] font-bold text-black/80 tracking-wide">
                  {task.startTime || '-'}
                  
      </div>
                <div className="text-[0.625rem] text-black/50 font-bold uppercase mt-1 tracking-wider">
                  Başlangıç
                  
      </div>
                
      </div>
              <div
                className="text-white text-[0.6875rem] px-3.5 py-1.5 rounded-full font-bold tracking-wide"
                style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
              >
                {task.duration || '-'}
                
      </div>
              <div className="text-right">
                <div className="text-[0.8125rem] font-bold text-black/80 tracking-wide">
                  {task.endTime || '-'}
                  
      </div>
                <div className="text-[0.625rem] text-black/50 font-bold uppercase mt-1 tracking-wider">
                  Bitiş
                  
      </div>
                
      </div>
            </>
          )}
          
      </div>
        
        {(task.subtasks && task.subtasks.length > 0 || task.attachments && task.attachments.length > 0) && (
          <div className="mt-4 pt-4 border-t border-black/10 flex items-center justify-between">
            {task.subtasks && task.subtasks.length > 0 ? (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-black/40" />
                <span className="text-[0.6875rem] font-bold text-black/60 uppercase tracking-widest">
                  {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} Alt Görev
                </span>
                
      </div>
            ) : <div />}
            
            {task.attachments && task.attachments.length > 0 && (
              <div className="flex items-center gap-1.5 text-black/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                <span className="text-[0.6875rem] font-bold uppercase tracking-widest">
                  {task.attachments.length} Dosya
                </span>
                
      </div>
            )}
            
      </div>
        )}
      </motion.div>
    </motion.div>
  );
}


export function getWeatherConfig(code: number, isDay: number) {
    if (code === 0 || code === 1) {
        return {
            gradient: 'from-blue-400/30 via-amber-200/20 dark:from-indigo-900/40 dark:via-purple-900/20',
            icon: isDay ? Sun : Moon
        };
    }
    if (code === 2 || code === 3) {
        return {
            gradient: 'from-slate-300/40 via-gray-200/20 dark:from-slate-800/50 dark:via-slate-700/20',
            icon: Cloud
        };
    }
    if (code >= 50 && code <= 67 || code >= 80 && code <= 82) {
        return {
            gradient: 'from-blue-600/30 via-slate-400/20 dark:from-blue-900/50 dark:via-slate-800/30',
            icon: CloudRain
        };
    }
    if (code >= 71 && code <= 77 || code >= 85 && code <= 86) {
        return {
            gradient: 'from-blue-100/40 via-slate-100/20 dark:from-slate-300/20 dark:via-blue-100/10',
            icon: CloudSnow
        };
    }
    if (code >= 95) {
        return {
            gradient: 'from-purple-800/30 via-slate-600/20 dark:from-purple-900/50 dark:via-slate-900/40',
            icon: CloudLightning
        };
    }
    return {
        gradient: 'from-slate-200/30 dark:from-slate-800/40',
        icon: Cloud
    };
}


function TodayView({ tasks, toggleTask, deleteTask, updateTask, onTaskClick, notificationPermission, onRequestPermission, setView, gmailToken, gmailEmails, isFetchingEmails, handleConnectGmail, weather, weatherLoading, fetchWeather }: { tasks: Task[], toggleTask: (id: string, current: boolean) => void, deleteTask: (id: string) => void, updateTask: (id: string, updates: Partial<Task>) => void, onTaskClick: (task: Task) => void, notificationPermission: NotificationPermission, onRequestPermission: () => void, setView: (view: any) => void, gmailToken: string | null, gmailEmails: any[], isFetchingEmails: boolean, handleConnectGmail: () => void, weather: { temp: number, code: number, isDay: number } | null, weatherLoading: boolean, fetchWeather: () => void }) {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const today = new Date();
  const dayNum = today.getDate();
  const monthName = today.toLocaleDateString("tr-TR", { month: "long" }).toUpperCase();
  const todayStr = getLocalISODate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalISODate(tomorrow);

  // Calculate week chart data
  const getWeekDays = () => {
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const weekDates = getWeekDays();
  const maxHoursPerDay = 8; // 8-hour workday is 100%

  const weekData = weekDates.map((date, i) => {
    const dateStr = getLocalISODate(date);
    const dayTasks = tasks.filter(t => t.date === dateStr);
    
    // Calculate total hours for the day based on the duration string (e.g. "5 Sa", "1 Sa 30 Dk")
    const totalHours = dayTasks.reduce((acc, task) => {
      let hours = 0;
      if (task.duration) {
        const hoursMatch = task.duration.match(/(\d+)\s*Sa/i);
        const minsMatch = task.duration.match(/(\d+)\s*Dk/i);
        
        if (hoursMatch) hours += parseInt(hoursMatch[1], 10);
        if (minsMatch) hours += parseInt(minsMatch[1], 10) / 60;
      }
      return acc + hours;
    }, 0);

    return { totalHours };
  });

  const totalWeekHours = weekData.reduce((acc, curr) => acc + curr.totalHours, 0);
  const overallPercentage = Math.round(Math.min((totalWeekHours / (5 * maxHoursPerDay)) * 100, 100));

  const totalBlocks = 10;
  const filledBlocks = Math.round((overallPercentage / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;

  const inboxCount = tasks.filter(t => t.inbox && !t.completed).length;
  
  const todayTasks = tasks.filter(t => t.date === todayStr && !t.inbox);
  const overdueTasks = tasks.filter(t => !t.completed && !t.inbox && t.date && t.date < todayStr);

  const focusTasks = [...todayTasks].filter(t => !t.completed).sort((a, b) => (b.importance === 'critical' ? 2 : b.importance === 'important' ? 1 : 0) - (a.importance === 'critical' ? 2 : a.importance === 'important' ? 1 : 0)).slice(0, 3);
  
  const programTasks = todayTasks.filter(t => !t.completed && !!t.startTime).sort((a, b) => a.startTime!.localeCompare(b.startTime!));
  
  const freeTasks = todayTasks.filter(t => !t.completed && !t.startTime);

  return (
    <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="relative w-full flex flex-col items-center pt-10">
        <div className="w-full max-w-2xl px-6 md:px-12 flex flex-col relative" style={{ zIndex: 10 }}>
          <div className="flex flex-col mb-10 md:mb-16 gap-3">
            <div className="flex flex-col items-start gap-2">
              <h1 className={`text-3xl md:text-4xl font-bold tracking-tight uppercase flex flex-col md:flex-row md:items-center gap-2 md:gap-3 transition-colors ${weather ? (weather.isDay ? "text-[#1a1a1a] drop-shadow-md" : "text-white drop-shadow-md") : "text-black dark:text-white"}`}>
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
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md self-start md:self-auto ${weather.isDay ? "bg-white/30" : "bg-black/30"}`}>
                    {(() => {
                      const Icon = getWeatherConfig(weather.code, weather.isDay).icon;
                      return <Icon className={`w-4 h-4 ${weather.isDay ? "text-black/80" : "text-white/90"}`} />;
                    })()}
                    <span className={`text-sm font-bold ${weather.isDay ? "text-black/80" : "text-white/90"}`}>{weather.temp}°</span>
                  </div>
                )}
              </h1>
              <div className="flex flex-col scale-90 origin-left md:scale-100 mt-1 md:mt-2">
                <h2 className={`text-[0.625rem] sm:text-[0.6875rem] font-bold uppercase tracking-widest mb-2 transition-colors ${weather ? (weather.isDay ? "text-black/50" : "text-white/50") : "text-black/40 dark:text-white/40"}`}>
                  Haftalık Yoğunluk
                </h2>
                <div className="flex gap-1">
                  {Array.from({ length: filledBlocks }).map((_, i) => (
                    <div key={`filled-${i}`} className={`w-5 h-2 rounded-sm transition-colors ${weather ? (weather.isDay ? "bg-black/40" : "bg-white/40") : "bg-black/20 dark:bg-white/20"}`} />
                  ))}
                  {Array.from({ length: emptyBlocks }).map((_, i) => (
                    <div key={`empty-${i}`} className={`w-5 h-2 rounded-sm transition-colors ${weather ? (weather.isDay ? "bg-black/10" : "bg-white/10") : "bg-black/5 dark:bg-white/5"}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-14">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-black/40 dark:text-white/40" />
                <h2 className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">Gelen Kutusu (Gmail)</h2>
              </div>
              {!gmailToken && (
                <button
                  onClick={handleConnectGmail}
                  className="text-[0.625rem] font-bold bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors text-black/80 dark:text-white/80"
                >
                  Bağlan
                </button>
              )}
            </div>
            
            {gmailToken ? (
              isFetchingEmails ? (
                <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-5 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-black/40 dark:text-white/40" />
                </div>
              ) : gmailEmails.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {gmailEmails.map((email: any) => (
                    <div key={email.id} onClick={() => { triggerHaptic('light'); setSelectedEmailId(email.id); }} className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 flex flex-col gap-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[0.8125rem] font-bold text-black/90 dark:text-white/90 line-clamp-1">{email.from}</span>
                      </div>
                      <span className="text-[0.875rem] font-semibold text-black/80 dark:text-white/80 line-clamp-1">{email.subject}</span>
                      <span className="text-[0.8125rem] text-black/50 dark:text-white/50 line-clamp-2 mt-1 leading-snug">{email.snippet}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-5 text-sm font-medium text-black/50 dark:text-white/50 text-center">
                  Son e-posta bulunamadı.
                </div>
              )
            ) : (
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-5 text-sm font-medium text-black/50 dark:text-white/50 text-center">
                Gelen son e-postalarınızı görmek için Gmail'e bağlanın.
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="w-full max-w-2xl px-6 md:px-12 flex flex-col mt-4">
        {overdueTasks.length > 0 && (
          <div className="mb-14">
            <h2 className="text-[0.6875rem] font-bold text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
               Gecikenler
            </h2>
            <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-5">
              <div className="flex flex-col gap-3">
                <AnimatePresence mode="popLayout">
                  {overdueTasks.map(t => (
                    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={t.id} className="flex items-center justify-between group">
                       <div className="flex flex-col">
                         <span onClick={() => onTaskClick(t)} className="text-red-500 font-semibold text-[15px] cursor-pointer group-hover:opacity-70 transition-opacity">{t.title}</span>
                         <span className="text-[0.6875rem] font-medium text-red-500/60 mt-0.5">{t.date}</span>
                       </div>
                       <button onClick={() => updateTask(t.id, { date: todayStr })} className="text-[0.625rem] font-bold uppercase tracking-wider px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
                         Bugüne Taşı
                       </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
      
    </div>
  )
}

        <div className="mb-14">
          <h2 className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-5">Bugünün Odağı</h2>
          <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-5">
            <div className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {focusTasks.map((t, i) => (
                  <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={t.id} onClick={() => onTaskClick(t)} className="flex items-start gap-4 cursor-pointer group">
                    <span className="text-black/30 dark:text-white/30 font-bold mt-0.5">{i + 1}</span>
                    <span className="text-black dark:text-white font-semibold text-lg leading-tight group-hover:opacity-70 transition-opacity">{t.title}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {focusTasks.length === 0 && <span className="text-black/30 dark:text-white/30 text-sm font-medium">Odak belirlenmedi</span>}
            </div>
          </div>
        </div>

        <div className="mb-14">
          <h2 className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-5">Program</h2>
          <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-5">
            <div className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {programTasks.map(t => (
                  <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={t.id} onClick={() => onTaskClick(t)} className="flex items-start gap-5 cursor-pointer group">
                    <span className="text-black/40 dark:text-white/40 font-bold w-12 text-sm shrink-0 mt-0.5 tracking-wide">{t.startTime}</span>
                    <span className="text-black dark:text-white font-medium text-[15px] group-hover:opacity-70 transition-opacity leading-snug">{t.title}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {programTasks.length === 0 && <span className="text-black/30 dark:text-white/30 text-sm font-medium">Program boş</span>}
            </div>
          </div>
        </div>

        <div className="mb-14">
          <h2 className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-5">Serbest Görevler</h2>
          <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-5">
            <div className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {freeTasks.map(t => (
                  <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={t.id} className="flex items-start gap-3 group">
                    <button onClick={() => { triggerHaptic('success'); toggleTask(t.id, t.completed); }} className="mt-0.5 shrink-0">
                      <div className="w-5 h-5 border-2 border-black/20 dark:border-white/20 rounded-[6px] hover:border-black/40 dark:hover:border-white/40 transition-colors" />
                    </button>
                    <span onClick={() => onTaskClick(t)} className="text-black dark:text-white font-medium text-[15px] cursor-pointer group-hover:opacity-70 transition-opacity leading-snug">{t.title}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {freeTasks.length === 0 && <span className="text-black/30 dark:text-white/30 text-sm font-medium">Serbest görev yok</span>}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-4">Aklımda</h2>
          <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-5">
            <div 
              onClick={() => { triggerHaptic('light'); setView('inbox'); }}
              className="flex items-center gap-3 cursor-pointer group bg-black/5 dark:bg-white/5 p-4 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <span className="text-black/60 dark:text-white/60 font-medium text-[15px]">{inboxCount} Inbox öğesi</span>
            </div>
          </div>
        </div>
      </div>
      <EmailDetailModal 
        isOpen={!!selectedEmailId} 
        onClose={() => setSelectedEmailId(null)} 
        emailId={selectedEmailId} 
        gmailToken={gmailToken}
        triggerHaptic={(type) => {}} 
      />
    </div>
  );
}

function CalendarView({ tasks, onTaskClick }: { tasks: Task[], onTaskClick: (task: Task) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

  const formatMonth = (d: Date) => d.toLocaleDateString("tr-TR", { month: "short" }).toUpperCase().replace('.', '');
  
  // Logic for "this month" starting from today, otherwise normal month length
  const today = new Date();
  const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  const startDay = isCurrentMonth ? today.getDate() : 1;
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  
  const days = Array.from({ length: daysInMonth - startDay + 1 }, (_, i) => 
    new Date(currentDate.getFullYear(), currentDate.getMonth(), startDay + i)
  );

  const colors = ['#b5abd0', '#d6a3a4', '#a0cec9', '#cde4a4', '#e7c57f'];

  const selectedDateTasks = selectedDate ? tasks.filter(t => t.date === getLocalISODate(selectedDate)) : [];

  return (
    <div className="flex flex-col px-6 md:px-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-center justify-between mt-4 mb-6 sticky top-0 bg-[#f4f4f4]/80 dark:bg-[#121212]/80 backdrop-blur-xl border-b border-black/[0.03] dark:border-white/[0.03] z-10 py-3 -mx-6 md:-mx-10 px-6 md:px-10 transition-colors duration-300">
        <span className="text-black/30 dark:text-white/30 font-semibold text-[1.0625rem] tracking-wide w-12 cursor-pointer" onClick={() => setCurrentDate(prevMonth)}>
          {formatMonth(prevMonth)}
        </span>
        <div className="flex items-center gap-1">
          <motion.button 
            whileTap={{ scale: 0.8 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            onClick={() => { triggerHaptic('light'); setCurrentDate(prevMonth); }} 
            className="p-2 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={3} />
          </motion.button>
          
          <div className="relative overflow-hidden w-24 h-8 flex items-center justify-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span 
                key={currentDate.toISOString()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="text-black dark:text-white text-xl font-bold tracking-wide absolute"
              >
                {formatMonth(currentDate)}
              </motion.span>
            </AnimatePresence>
            
      </div>

          <motion.button 
            whileTap={{ scale: 0.8 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            onClick={() => { triggerHaptic('light'); setCurrentDate(nextMonth); }} 
            className="p-2 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}
          >
            <ChevronRight className="w-5 h-5" strokeWidth={3} />
          </motion.button>
          
      </div>
        <span className="text-black/30 dark:text-white/30 font-semibold text-[1.0625rem] tracking-wide w-12 text-right cursor-pointer" onClick={() => setCurrentDate(nextMonth)}>
          {formatMonth(nextMonth)}
        </span>
        
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {days.map((dateObj, i) => {
          const day = dateObj.getDate();
          const dayName = dateObj.toLocaleDateString("tr-TR", { weekday: "long" });
          const monthName = formatMonth(dateObj);
          const color = colors[i % colors.length];
          const dateStr = getLocalISODate(dateObj);
          const dayTasks = tasks.filter(t => t.date === dateStr);

          return (
            <motion.div
              key={dateObj.toISOString()}
              onClick={() => { triggerHaptic('light'); setSelectedDate(dateObj); }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="rounded-[28px] p-5 flex items-stretch gap-4 relative overflow-hidden cursor-pointer"
              style={{ backgroundColor: color, minHeight: "160px", WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex flex-col w-20 shrink-0 pointer-events-none">
                <span className="text-black/50 font-bold text-[0.6875rem] uppercase tracking-widest">
                  {dayName}
                </span>
                <span className="text-[3.2rem] font-semibold text-black/80 leading-[0.9] -ml-0.5 tracking-tight my-1">
                  {day}
                </span>
                <span className="text-[18px] font-bold text-black/40 leading-none uppercase tracking-wide">
                  {monthName}
                </span>
                
      </div>

              <div className="flex-1 relative flex">
                {/* Timeline lines */}
                <div className="absolute inset-y-0 left-0 w-px bg-black/20"></div>
                <div className="absolute inset-y-0 left-1/2 w-px bg-black/20"></div>
                <div className="absolute inset-y-0 right-0 w-px bg-black/20"></div>

                {/* Time markers */}
                <span className="absolute top-0 left-1.5 text-[9px] font-bold text-black/40 uppercase tracking-widest">
                  15:00
                </span>
                <span className="absolute top-0 left-[calc(50%+6px)] text-[9px] font-bold text-black/40 uppercase tracking-widest">
                  16:00
                </span>
                <span className="absolute top-0 right-auto left-[calc(100%+6px)] -translate-x-full pr-1.5 text-[9px] font-bold text-black/40 uppercase tracking-widest">
                  05:00
                </span>

                {/* Events */}
                <div className="absolute top-7 left-1.5 right-1.5 flex flex-col gap-1.5 pointer-events-none">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="bg-black text-white text-[0.625rem] px-2.5 py-1 rounded-full font-semibold tracking-wide truncate max-w-full">
                      {task.startTime} - {task.title.replace('\n', ' ')}
                      
      </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[0.625rem] font-bold text-black/50 pl-2">
                      +{dayTasks.length - 3} daha...
                      
      </div>
                  )}
                  
      </div>
                
      </div>
            </motion.div>
          );
        })}
        
      </div>

      {/* Day Details Modal */}
      

        <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4 pb-0"
            onClick={() => setSelectedDate(null)}
          >
            <motion.div
              initial={{ y: "100%", scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: "100%", scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
              className="bg-white dark:bg-[#1c1c1e] w-full max-w-md rounded-t-[32px] p-6 shadow-2xl h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                  <h3 className="text-2xl font-semibold text-black dark:text-white tracking-tight">
                    {selectedDate.getDate()} {selectedDate.toLocaleDateString("tr-TR", { month: "long" })}
                  </h3>
                  <p className="text-black/50 dark:text-white/50 font-medium capitalize">{selectedDate.toLocaleDateString("tr-TR", { weekday: "long" })}</p>
                  
      </div>
                <button aria-label="Kapat" onClick={() => setSelectedDate(null)} className="p-2 bg-black/5 dark:bg-white/5 rounded-full text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition">
                  <X className="w-5 h-5" />
                </button>
                
      </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-3 pb-8">
                {selectedDateTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 opacity-50">
                    <CalendarIcon className="w-12 h-12 mb-4 text-black/40 dark:text-white/40" />
                    <p className="font-medium text-black/60 dark:text-white/60 text-lg">Bu güne ait görev yok</p>
                    
      </div>
                ) : (
                  selectedDateTasks.map((task) => (
                    <motion.div 
                      key={task.id} 
                      onClick={() => { triggerHaptic('light'); onTaskClick(task); }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                      className={`rounded-[24px] p-4 flex flex-col justify-between cursor-pointer ${task.completed ? 'opacity-50 grayscale' : ''}`}
                      style={{ backgroundColor: task.color, minHeight: "100px", WebkitTapHighlightColor: "transparent" }}
                    >
                      <h4 className={`text-xl font-medium text-black/80 leading-tight whitespace-pre-line pointer-events-none ${task.completed ? 'line-through' : ''}`}>
                        {task.title}
                      </h4>
                      <div className="flex items-center justify-between mt-4 pointer-events-none">
                        <span className="bg-black/20 text-black/80 text-[0.625rem] px-3 py-1 rounded-full font-bold">
                          {task.startTime} - {task.endTime}
                        </span>
                        <div className="flex -space-x-2">
                          {(task.attendees || []).map((a, i) => (
                            <img
                              key={a.id}
                              src={a.avatarUrl}
                              alt="Attendee"
                              className="w-6 h-6 rounded-full border border-black/10"
                              style={{ zIndex: 10 - i }}
                            />
                          ))}
                          
      </div>
                        
      </div>
                    </motion.div>
                  ))
                )}
                
      </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WeeklyReviewView({ tasks, updateTask, deleteTask, setView }: { tasks: Task[], updateTask: (id: string, updates: Partial<Task>) => void, deleteTask: (id: string) => void, setView: (view: any) => void }) {
  const today = new Date();
  const lastWeekDate = new Date(today);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  
  const todayStr = getLocalISODate(today);
  const lastWeekStr = getLocalISODate(lastWeekDate);

  const pastWeekTasks = tasks.filter(t => t.date && t.date >= lastWeekStr && t.date <= todayStr && !t.inbox);
  const completedTasks = pastWeekTasks.filter(t => t.completed);
  
  const totalPlanned = pastWeekTasks.length;
  const totalCompleted = completedTasks.length;
  
  // Calculate postponed based on rolloverCount
  const postponedTasks = pastWeekTasks.filter(t => (t.rolloverCount || 0) > 0);
  const totalPostponed = postponedTasks.reduce((acc, t) => acc + (t.rolloverCount || 0), 0);
  
  // Actually, we want to know most postponed task
  const mostPostponed = [...postponedTasks].sort((a, b) => (b.rolloverCount || 0) - (a.rolloverCount || 0))[0];

  // Busiest day
  const dayCounts: Record<string, number> = {};
  pastWeekTasks.forEach(t => {
    if (t.date) {
      dayCounts[t.date] = (dayCounts[t.date] || 0) + 1;
    }
  });
  
  let busiestDate = '';
  let maxCount = 0;
  Object.entries(dayCounts).forEach(([date, count]) => {
    if (count > maxCount) {
      maxCount = count;
      busiestDate = date;
    }
  });

  const busiestDayName = busiestDate ? new Date(busiestDate).toLocaleDateString("tr-TR", { weekday: "long" }) : 'Yok';

  // Remaining tasks from last week
  const remainingTasks = pastWeekTasks.filter(t => !t.completed && t.date && t.date < todayStr);

  return (
    <div className="flex flex-col px-6 md:px-12 py-10 w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-black dark:text-white uppercase flex items-center gap-3">
          HAFTALIK DEĞERLENDİRME
        </h1>
        <button 
          onClick={() => { triggerHaptic('light'); setView('today'); }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
      </div>

      <div className="grid grid-cols-2 gap-4 mb-12">
        <div className="bg-black/5 dark:bg-white/5 p-6 rounded-3xl flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-bold text-black dark:text-white mb-2">{totalPlanned}</span>
          <span className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">Görev Planlandı</span>
          
      </div>
        <div className="bg-emerald-500/10 p-6 rounded-3xl flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-bold text-emerald-600 mb-2">{totalCompleted}</span>
          <span className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest">Tamamlandı</span>
          
      </div>
        <div className="bg-orange-500/10 p-6 rounded-3xl flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-bold text-orange-600 mb-2">{totalPostponed}</span>
          <span className="text-[10px] font-bold text-orange-600/60 uppercase tracking-widest">Kez Ertelendi</span>
          
      </div>
        <div className="bg-black/5 dark:bg-white/5 p-6 rounded-3xl flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-black dark:text-white mb-2 capitalize">{busiestDayName}</span>
          <span className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">En Yoğun Gün</span>
          
      </div>
        
      </div>

      {mostPostponed && (
        <div className="mb-12 bg-black/5 dark:bg-white/5 p-6 rounded-3xl flex flex-col items-center text-center">
          <span className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-3">En Çok Ertelenen Görev</span>
          <span className="text-lg font-semibold text-black dark:text-white leading-tight">{mostPostponed.title}</span>
          <span className="text-xs font-bold text-orange-600 mt-2">{mostPostponed.rolloverCount} kez</span>
          
      </div>
      )}

      <div>
        <h2 className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-6 flex items-center justify-between">
          <span>Geçen Haftadan Kalanlar ({remainingTasks.length})</span>
          <span>Yeni haftaya aktar?</span>
        </h2>
        
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {remainingTasks.map(t => (
              <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={t.id} className="bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 p-4 rounded-2xl flex flex-col gap-4">
                <span className="text-black dark:text-white font-semibold text-[15px] leading-snug">{t.title}</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { triggerHaptic('success'); updateTask(t.id, { date: todayStr }); }}
                    className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-80 transition-opacity text-center"
                  >
                    Taşı
                  </button>
                  <button 
                    onClick={() => { triggerHaptic('light'); updateTask(t.id, { inbox: true, date: '' }); }}
                    className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 bg-black/5 dark:bg-white/5 text-black dark:text-white rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-center"
                  >
                    Inbox
                  </button>
                  <button 
                    onClick={() => { triggerHaptic('warning'); deleteTask(t.id); }}
                    className="flex-1 text-[10px] font-bold uppercase tracking-widest px-3 py-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors text-center"
                  >
                    Sil
                  </button>
                  
      </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {remainingTasks.length === 0 && <span className="text-black/40 dark:text-white/40 text-sm font-medium text-center py-8">Kalan görev yok. Harika bir hafta!</span>}
          
      </div>
        

        
      </div>
    </div>
  );
}


export default function App() {
  const [view, setView] = useState<"inbox" | "today" | "calendar" | "kanvas" | "weekly-review">("today");
  const [weather, setWeather] = useState<{ temp: number, code: number, isDay: number } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const fetchWeather = async (savedLat?: number, savedLon?: number) => {
      if (savedLat !== undefined && savedLon !== undefined) {
         setWeatherLoading(true);
         try {
           const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${savedLat}&longitude=${savedLon}&current=temperature_2m,weather_code,is_day`);
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
           const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`);
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
         console.error("Geolocation error:", err.message); alert("Konum alınamadı: " + err.message + "\nLütfen tarayıcı/sistem ayarlarından konum izni verdiğinizden emin olun.");
      });
  };
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [gmailEmails, setGmailEmails] = useState<any[]>([]);
  const [isFetchingEmails, setIsFetchingEmails] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const sheetDragControls = useDragControls();
  const prefersReducedMotion = useReducedMotion();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleGmailError = (e: any) => {
    console.error(e);
    if (e?.message === '401_UNAUTHENTICATED' || e?.status === 401) {
      setGmailToken(null);
      if (user) {
        setDoc(doc(db, 'users', user.uid), { gmailToken: null }, { merge: true });
      }
    }
  };
  const handleGoogleError = (e: any) => {
    console.error(e);
    if (e?.message === '401_UNAUTHENTICATED') {
      setAccessToken(null);
      if (user) {
        setDoc(doc(db, 'users', user.uid), { googleCalendarToken: null }, { merge: true });
      }
      // Optionally notify user
    }
  };

  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const [undoTask, setUndoTask] = useState<Task | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    // Other key handlers can be added here
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  
  const { permission: notificationPermission, requestPermission: onRequestPermission } = useTaskNotifications(tasks, user);

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fetch User Preferences Effect
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribePrefs = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.gmailToken && data.gmailToken !== gmailToken) {
           setGmailToken(data.gmailToken);
        }
        if (data.googleCalendarToken && data.googleCalendarToken !== accessToken) {
           setAccessToken(data.googleCalendarToken);
        }
        if (data.weatherLocation && data.weatherLocation.lat && data.weatherLocation.lon && !weather && !weatherLoading) {
           fetchWeather(data.weatherLocation.lat, data.weatherLocation.lon);
        }
      }
    });
    return unsubscribePrefs;
  }, [user, weather, weatherLoading, accessToken]);

  // Fetch Tasks Effect
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }
    const q = query(
      collection(db, `users/${user.uid}/tasks`),
      where("ownerId", "==", user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(fetchedTasks);
    }, (error) => {
      console.error("Firestore Error:", error);
    });
    return unsubscribe;
  }, [user]);

  const hasSyncedRef = useRef(false);

  // Sync Google Calendar
  useEffect(() => {
    if (user && accessToken && tasks.length > 0 && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      syncGoogleCalendar(accessToken, user.uid, tasks).catch(handleGoogleError);
    }
  }, [user, accessToken, tasks]); // Run when tasks populate, but only sync once per session

  // Fetch Gmail emails
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchEmails = () => {
      if (!gmailToken) return;
      // Don't set isFetchingEmails to true on every interval to avoid UI flicker, only on initial load
      // Or we can just let it fetch silently in the background
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3', {
        headers: { Authorization: `Bearer ${gmailToken}` }
      })
      .then(res => {
        if (!res.ok) {
          if (res.status === 401) throw new Error('401_UNAUTHENTICATED');
          throw new Error('Failed to fetch messages');
        }
        return res.json();
      })
      .then(async data => {
        if (data.messages && data.messages.length > 0) {
          const emailPromises = data.messages.map((m: any) => 
            fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, {
              headers: { Authorization: `Bearer ${gmailToken}` }
            }).then(r => r.json())
          );
          const fullEmails = await Promise.all(emailPromises);
          
          const formattedEmails = fullEmails.map((email: any) => {
            const subjectHeader = email.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject');
            const fromHeader = email.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from');
            return {
              id: email.id,
              snippet: email.snippet,
              subject: subjectHeader ? subjectHeader.value : '(Konu yok)',
              from: fromHeader ? fromHeader.value.split('<')[0].trim() : 'Bilinmeyen'
            };
          });
          setGmailEmails(formattedEmails);
        } else {
          setGmailEmails([]);
        }
      })
      .catch(handleGmailError)
      .finally(() => setIsFetchingEmails(false));
    };

    if (gmailToken) {
      if (gmailEmails.length === 0) setIsFetchingEmails(true);
      fetchEmails();
      intervalId = setInterval(fetchEmails, 30000); // 30 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [gmailToken]);

  const toggleTask = async (id: string, current: boolean) => {
    if (!user) return;
    try {
      const taskToToggle = tasks.find(t => t.id === id);
      if (taskToToggle && taskToToggle.googleEventId && accessToken) {
          const updatedTask = { ...taskToToggle, completed: !current };
          await updateGoogleEvent(accessToken, updatedTask.googleEventId, updatedTask).catch(handleGoogleError);
      }

      const taskRef = doc(db, `users/${user.uid}/tasks`, id);
      await updateDoc(taskRef, {
        completed: !current,
        updatedAt: serverTimestamp()
      });
      triggerHaptic('success');
    } catch (e) {
      console.error("Error toggling task:", e);
    }
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;
    try {
      if (taskToDelete.googleEventId && accessToken) {
          await deleteGoogleEvent(accessToken, taskToDelete.googleEventId).catch(handleGoogleError);
      }

      const taskRef = doc(db, `users/${user.uid}/tasks`, id);
      await deleteDoc(taskRef);
      triggerHaptic('success');
      
      setUndoTask(taskToDelete);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = setTimeout(() => {
        setUndoTask(null);
      }, 5000);
    } catch (e) {
      console.error("Error deleting task:", e);
    }
  };

  const handleUndoDelete = async () => {
    if (!user || !undoTask) return;
    try {
      const taskRef = doc(db, `users/${user.uid}/tasks`, undoTask.id);
      
      // Filter out 'id' from undoTask to prevent it from being saved as a field
      const { id, createdAt, updatedAt, ...restTask } = undoTask as any;
      
      await setDoc(taskRef, {
        ...restTask,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setUndoTask(null);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      triggerHaptic('light');
    } catch (e) {
      console.error("Error undoing delete:", e);
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    if (!user) return;
    try {
      const taskRef = doc(db, `users/${user.uid}/tasks`, id);
      await updateDoc(taskRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      triggerHaptic('success');
      
      const updatedTask = tasks.find(t => t.id === id);
      if (updatedTask && updatedTask.googleEventId && accessToken) {
          await updateGoogleEvent(accessToken, updatedTask.googleEventId, { ...updatedTask, ...updates }).catch(handleGoogleError);
      }
    } catch (e) {
      console.error("Error updating task:", e);
    }
  };

  const handleAddTask = async (taskData: Partial<Task>) => {
    if (!user) return;

    if (editingTask) {
      try {
        const taskRef = doc(db, `users/${user.uid}/tasks`, editingTask.id);
        const updates: any = {
          ...taskData,
          updatedAt: serverTimestamp()
        };
        // Don't overwrite properties that shouldn't change
        delete updates.createdAt;
        delete updates.ownerId;
        
        await updateDoc(taskRef, updates);
        triggerHaptic('success');
      } catch (e) {
        console.error("Error updating task:", e);
      }
      setIsAdding(false);
      setEditingTask(null);
      return;
    }

    const colors = ['#e7c57f', '#bac5c4', '#b5abd0', '#d6a3a4', '#a0cec9', '#cde4a4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const taskId = Date.now().toString(); // Use as custom doc ID
    const newTask: any = {
      title: taskData.title || '',
      date: taskData.date || getLocalISODate(new Date()),
      dueDate: taskData.dueDate || null,
      isAllDay: taskData.isAllDay || false,
      importance: taskData.importance || 'normal',
      startTime: taskData.startTime || null,
      endTime: taskData.endTime || null,
      duration: taskData.duration || null,
      inbox: taskData.inbox || false,
      rolloverCount: 0,
      color: taskData.color || randomColor,
      type: 'task',
      completed: false,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      subtasks: taskData.subtasks || []
    };
    
    if (taskData.locationName) {
      newTask.locationName = taskData.locationName;
    }
    if (taskData.attachments) {
      newTask.attachments = taskData.attachments;
    }
    if (taskData.reminders) {
      newTask.reminders = taskData.reminders;
    }

    try {
      if (accessToken) {
          const gId = await createGoogleEvent(accessToken, newTask).catch(handleGoogleError);
          if (gId) newTask.googleEventId = gId;
      }
      const taskRef = doc(db, `users/${user.uid}/tasks`, taskId);
      await setDoc(taskRef, newTask);
      setIsAdding(false);
      triggerHaptic('success');
    } catch (e) {
      console.error("Error adding task:", e);
    }
  };

  const getAiRecommendation = async () => {
    if (isAiLoading || aiRecommendation) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, todayStr: getLocalISODate(new Date()) })
      });
      const data = await res.json();
      if (data.recommendation) {
        setAiRecommendation(data.recommendation);
      } else if (data.error) {
        let errMsg = data.error;
        try {
          const parsed = JSON.parse(data.error);
          if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
        } catch(e) {}
        setAiRecommendation(`**Hata:** ${errMsg}. \n\nLütfen AI Studio **Settings (Ayarlar)** panelinden geçerli bir Gemini API Anahtarı girdiğinizden emin olun.`);
      }
    } catch (e: any) {
      console.error("AI Error:", e);
      setAiRecommendation(`**Bir hata oluştu:** ${e.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const [authError, setAuthError] = useState<string | null>(null);
  const authErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showOAuthError = (err: unknown) => {
    const msg = normalizeOAuthError(err);
    setAuthError(msg);
    if (authErrorTimeoutRef.current) clearTimeout(authErrorTimeoutRef.current);
    authErrorTimeoutRef.current = setTimeout(() => {
      setAuthError(null);
    }, 6000);
  };

  const handleFirebaseLoginAction = async () => {
    try {
      setAuthError(null);
      await handleFirebaseLogin();
      triggerHaptic('success');
    } catch (error) {
      showOAuthError(error);
    }
  };

  const handleConnectCalendarAction = async () => {
    if (!user) {
      setAuthError('Takvim bağlantısı için önce NOX oturumu açmalısınız.');
      return;
    }
    try {
      setAuthError(null);
      const token = await handleConnectCalendar(user);
      setAccessToken(token);
      await setDoc(doc(db, 'users', user.uid), { googleCalendarToken: token }, { merge: true });
      triggerHaptic('success');
    } catch (error) {
      showOAuthError(error);
    }
  };

  const handleConnectGmailAction = async () => {
    if (!user) {
      setAuthError('Gmail bağlantısı için önce NOX oturumu açmalısınız.');
      return;
    }
    try {
      setAuthError(null);
      const token = await handleConnectGmail(user);
      setGmailToken(token);
      await setDoc(doc(db, 'users', user.uid), { gmailToken: token }, { merge: true });
      triggerHaptic('success');
    } catch (error) {
      showOAuthError(error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#e5e5e5] text-black font-sans flex justify-center items-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-2 border-black border-t-transparent animate-spin mb-4" />
          <p className="font-medium text-black/40 tracking-wider text-sm uppercase">Yükleniyor...</p>
          
      </div>
        
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f4f4f4] text-black font-sans flex justify-center items-center">
        <div className="w-full max-w-2xl flex flex-col items-center justify-center p-8 relative">
          {/* Background decoration */}
          <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-black/[0.03] via-transparent to-transparent pointer-events-none" />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center z-10"
          >
            <div className="w-20 h-20 bg-black rounded-3xl shadow-xl flex items-center justify-center mb-8 rotate-3">
              <CalendarIcon className="w-10 h-10 text-white" strokeWidth={1.5} />
              
      </div>
            
            <h1 className="text-4xl font-semibold tracking-tight text-black mb-3">Tasks</h1>
            <p className="text-black/50 text-center text-[0.9375rem] max-w-[280px] mb-12 font-medium leading-relaxed">
              Günlük görevlerinizi şık ve akıcı bir biçimde yönetin.
            </p>
            
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleFirebaseLoginAction}
              className="bg-white text-black border border-black/10 shadow-sm rounded-full py-3.5 px-8 flex items-center gap-3 font-semibold text-[0.9375rem] hover:bg-black/5 transition-colors w-full justify-center"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google ile Giriş Yap
            </motion.button>
            {authError && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-600 rounded-2xl text-xs font-medium text-center max-w-[320px]"
              >
                {authError}
              </motion.div>
            )}
          </motion.div>
          
      </div>
        
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${(weather && view === "today") ? "bg-transparent" : "bg-[#f4f4f4] dark:bg-[#121212]"} text-black dark:text-white font-sans selection:bg-black/10 dark:selection:bg-white/10 transition-colors duration-300`}>
      {(weather && view === "today") && <div className="fixed inset-0 w-screen h-screen pointer-events-none" style={{ zIndex: 0 }}><WeatherBackground weatherCode={weather.code} isDay={weather.isDay} /></div>}
      <div className="w-full max-w-5xl mx-auto min-h-screen flex flex-col relative" style={{ zIndex: 10 }}>
        {/* Header */}
        <header className={`hidden md:flex items-center justify-between px-6 md:px-10 pt-12 md:pt-10 pb-4 sticky top-0 z-20 backdrop-blur-xl border-b border-black/[0.03] dark:border-white/[0.03] transition-colors duration-300 ${(weather && view === "today") ? (weather.isDay ? "bg-white/30" : "bg-black/30") : "bg-[#f4f4f4]/80 dark:bg-[#121212]/80"}`}>
          <div className="hidden md:flex items-center bg-black/[0.06] dark:bg-white/[0.06] p-[3px] rounded-full relative">
            {(["inbox", "today", "calendar", "kanvas"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { triggerHaptic('light'); setView(tab); }}
                className={`relative px-2.5 sm:px-5 py-1 sm:py-2 text-[0.625rem] sm:text-[0.8125rem] tracking-wide font-semibold z-10 transition-colors duration-300 ${
                  view === tab ? "text-white dark:text-black" : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                }`}
                style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}
              >
                {view === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-black dark:bg-white rounded-full -z-10 shadow-sm"
                    initial={false}
                    transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                  />
                )}
                {tab === "inbox" ? "Inbox" : tab === "today" ? "Bugün" : tab === "calendar" ? "Takvim" : "Kanvas"}
              </button>
            ))}
            
      </div>

          <div className="flex items-center gap-2 relative ml-auto md:ml-0">
            <motion.button 
              aria-label="Ayarlar"
              whileTap={{ scale: 0.88 }}
              onClick={() => { triggerHaptic('light'); setIsSettingsOpen(!isSettingsOpen); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition ${isSettingsOpen ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              <UserIcon className="w-5 h-5" />
            </motion.button>

            
              <motion.button
              aria-label="Yeni Görev Ekle"
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              onClick={() => { triggerHaptic('medium'); setIsAdding(true); }}
              style={{ WebkitTapHighlightColor: "transparent" }}
              className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shadow-sm relative z-40"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </motion.button>
            
      </div>
        </header>
        <MobileDock view={view} setView={setView} setIsAdding={setIsAdding} setIsSettingsOpen={setIsSettingsOpen} />

        {/* Settings Modal - Moved out of hidden header */}
        <AnimatePresence>
              {isSettingsOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setIsSettingsOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    className="fixed md:absolute md:top-12 md:right-12 bottom-28 left-1/2 -translate-x-1/2 md:bottom-auto md:left-auto md:translate-x-0 md:mt-2 w-56 md:w-48 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl rounded-2xl shadow-xl border border-black/5 dark:border-white/5 p-2 z-[70]"
                  >
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setIsDarkMode(!isDarkMode);
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                    >
                      {isDarkMode ? <Sun className="w-4 h-4 text-black/60 dark:text-white/60" /> : <Moon className="w-4 h-4 text-black/60 dark:text-white/60" />}
                      <span className="text-[0.8125rem] font-semibold text-black/80 dark:text-white/80">
                        {isDarkMode ? 'Açık Mod' : 'Koyu Mod'}
                      </span>
                    </button>
                    {!accessToken && (
                      <button
                        onClick={() => {
                          triggerHaptic('light');
                          handleConnectCalendarAction();
                          setIsSettingsOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                      >
                        <CalendarIcon className="w-4 h-4 text-black/60 dark:text-white/60" />
                        <span className="text-[0.8125rem] font-semibold text-black/80 dark:text-white/80">
                          Takvim'e Bağlan
                        </span>
                      </button>
                    )}
                    <div className="h-[1px] bg-black/5 dark:bg-white/5 my-1 mx-2" />
                    <button 
                      onClick={() => {
                        triggerHaptic('light');
                        onRequestPermission();
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-black/60 dark:text-white/60"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                        <span className="text-[0.8125rem] font-semibold text-black/80 dark:text-white/80">
                          Bildirimler
                        </span>
                        
      </div>
                      <span className={`text-[0.625rem] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        notificationPermission === 'granted' 
                          ? 'bg-black/10 dark:bg-white/10 text-black/60 dark:text-white/60' 
                          : 'bg-black dark:bg-white text-white dark:text-black'
                      }`}>
                        {notificationPermission === 'granted' ? 'Açık' : notificationPermission === 'denied' ? 'Engellendi' : 'İzin Ver'}
                      </span>
                    </button>

                    <div className="h-[1px] bg-black/5 dark:bg-white/5 my-1 mx-2" />

                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setIsAiChatOpen(true);
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <MessageCircle className="w-4 h-4 text-black/60 dark:text-white/60" />
                      <span className="text-[0.8125rem] font-semibold text-black/80 dark:text-white/80">Yapay Zeka Sohbeti</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setView('kanvas');
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <LayoutDashboard className="w-4 h-4 text-black/60 dark:text-white/60" />
                      <span className="text-[0.8125rem] font-semibold text-black/80 dark:text-white/80">Kanvas</span>
                    </button>
                    <div className="h-[1px] bg-black/5 dark:bg-white/5 my-1 mx-2" />


                    

                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        signOut(auth);
                        setIsSettingsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 transition-colors text-left text-red-500"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-[0.8125rem] font-semibold">Çıkış Yap</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

        {/* Content */}
        <main className="flex-1 pb-10">
          {view === "inbox" ? (
            <InboxView 
              tasks={tasks}
              addTask={(title) => handleAddTask({ title, inbox: true, color: '#e5e5e5' } as any)}
              onTaskClick={setSelectedTask}
              toggleTask={toggleTask}
              deleteTask={deleteTask}
            />
          ) : view === "today" ? (
            <TodayView 
              tasks={tasks}
              toggleTask={toggleTask}
              deleteTask={deleteTask}
              updateTask={updateTask}
              onTaskClick={setSelectedTask}
              notificationPermission={notificationPermission}
              onRequestPermission={onRequestPermission}
              setView={setView}
              weather={weather}
              weatherLoading={weatherLoading}
              fetchWeather={fetchWeather}
              gmailToken={gmailToken}
              gmailEmails={gmailEmails}
              isFetchingEmails={isFetchingEmails}
              handleConnectGmail={handleConnectGmailAction}
            />
          ) : view === "calendar" ? (
            <CalendarView tasks={tasks} onTaskClick={setSelectedTask} />
          ) : view === "weekly-review" ? (
            <WeeklyReviewView tasks={tasks} updateTask={updateTask} deleteTask={deleteTask} setView={setView} />
          ) : (
            <CanvasView tasks={tasks} onTaskClick={setSelectedTask} onAddRequest={() => setIsAdding(true)} onClose={() => setView('today')} />
          )}
        </main>

        <AnimatePresence>
          {(isAdding || editingTask) && (
            <AddTaskModal onClose={() => { setIsAdding(false); setEditingTask(null); }} onAdd={handleAddTask} initialTask={editingTask} />
          )}
        </AnimatePresence>

        {/* Task Details Modal as Bottom Sheet */}
        <AnimatePresence>
          {selectedTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4"
              onClick={() => setSelectedTask(null)}
            >
              <motion.div
                drag="y"
                dragListener={false}
                dragControls={sheetDragControls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 1 }}
                onDragEnd={(e, info) => {
                  if (info.offset.y > 100 || (info.offset.y > 50 && info.velocity.y > 300)) {
                    setSelectedTask(null);
                  }
                }}
                initial={prefersReducedMotion ? { opacity: 0 } : { y: "100%" }}
                animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { y: "100%" }}
                transition={prefersReducedMotion ? { duration: 0.2 } : { type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
                className="w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl relative overflow-y-auto"
                style={{ backgroundColor: selectedTask.color }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag Handle */}
                <div 
                  className="w-12 h-1.5 bg-black/10 rounded-full mx-auto mb-6 cursor-grab active:cursor-grabbing sm:hidden"
                  onPointerDown={(e) => sheetDragControls.start(e)}
                />
                
                <button 
                  aria-label="Kapat"
                  onClick={() => setSelectedTask(null)} 
                  className="absolute top-6 right-6 p-2 bg-black/10 rounded-full text-black/60 hover:text-black transition"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="mt-2 mb-8">
                  <h3 className="text-[1.75rem] font-semibold text-black/90 leading-[1.1] whitespace-pre-line tracking-tight mb-8">
                    {selectedTask.title}
                  </h3>
                  
                  <div className="flex flex-col gap-5">
                    {selectedTask.isAllDay ? (
                      <div className="flex items-center gap-3.5 text-black/70">
                        <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                          <CalendarIcon className="w-4 h-4 text-black/60" />
                          
      </div>
                        <span className="font-semibold tracking-wide">Tüm Gün</span>
                        
      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3.5 text-black/70">
                          <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-black/60" />
                            
      </div>
                          <span className="font-semibold tracking-wide">{selectedTask.startTime || '-'} - {selectedTask.endTime || '-'}</span>
                          
      </div>
                        <div className="flex items-center gap-3.5 text-black/70">
                          <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                            <CalendarIcon className="w-4 h-4 text-black/60" />
                            
      </div>
                          <span className="font-semibold tracking-wide">{selectedTask.duration || '-'} Süre</span>
                          
      </div>
                      </>
                    )}
                    {selectedTask.locationName && (
                      <div className="flex items-center gap-3.5 text-black/70">
                        <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-black/60" />
                          
      </div>
                        <span className="font-semibold tracking-wide">{selectedTask.locationName}</span>
                        
      </div>
                    )}
                    
                    {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                      <div className="mt-2 bg-black/5 rounded-2xl p-4">
                        <h5 className="text-[0.6875rem] font-bold text-black/40 uppercase tracking-widest mb-3">Alt Görevler</h5>
                        <div className="flex flex-col gap-2">
                          {selectedTask.subtasks.map((st) => (
                            <button 
                              key={st.id} 
                              onClick={() => {
                                triggerHaptic('light');
                                const updatedSubtasks = selectedTask.subtasks!.map(s => s.id === st.id ? { ...s, completed: !s.completed } : s);
                                updateTask(selectedTask.id, { subtasks: updatedSubtasks });
                                setSelectedTask({ ...selectedTask, subtasks: updatedSubtasks });
                              }}
                              className="flex items-center gap-2 text-left hover:bg-black/5 p-1 rounded-lg transition-colors"
                            >
                              <div className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${st.completed ? 'bg-black border-black text-white' : 'border-black/30'}`}>
                                {st.completed && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                
      </div>
                              <span className={`text-[0.8125rem] font-semibold text-black/80 ${st.completed ? 'line-through opacity-50' : ''}`}>{st.title}</span>
                            </button>
                          ))}
                          
      </div>
      
    </div>
  )
}
                    
                    {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                      <div className="mt-2 bg-black/5 rounded-2xl p-4">
                        <h5 className="text-[0.6875rem] font-bold text-black/40 uppercase tracking-widest mb-3">Dosyalar</h5>
                        <div className="flex flex-col gap-2">
                          {selectedTask.attachments.map((file) => (
                            <a
                              key={file.id}
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-left bg-black/5 hover:bg-black/10 p-2.5 rounded-xl transition-colors cursor-pointer"
                            >
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-black/10 flex items-center justify-center text-black/60">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                
      </div>
                              <div className="flex-1 overflow-hidden">
                                <div className="text-[0.8125rem] font-semibold text-black/80 line-clamp-1">{file.name}</div>
                                <div className="text-[0.6875rem] text-black/50 uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                
      </div>
                              <div className="p-1.5 rounded-full hover:bg-black/10 transition-colors text-black/40 hover:text-black">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                
      </div>
                            </a>
                          ))}
                          
      </div>
      
    </div>
  )
}
                    
      </div>
                  
      </div>
                
                <div className="flex flex-col gap-3">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    onClick={() => {
                      triggerHaptic('light');
                      setEditingTask(selectedTask);
                      setSelectedTask(null);
                    }}
                    className="w-full bg-black/[0.08] text-black/80 py-3 rounded-[16px] font-semibold text-[0.9375rem]"
                    style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}
                  >
                    Düzenle
                  </motion.button>
                  <div className="flex gap-3">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                      onClick={() => {
                        triggerHaptic('medium');
                        toggleTask(selectedTask.id, !!selectedTask.completed);
                        setSelectedTask(null);
                      }}
                      className="flex-1 bg-black text-white py-3 rounded-[16px] font-semibold text-[0.9375rem]"
                      style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}
                    >
                      {selectedTask.completed ? 'Geri Al' : 'Tamamla'}
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                      onClick={() => {
                        triggerHaptic('warning');
                        deleteTask(selectedTask.id);
                        setSelectedTask(null);
                      }}
                      className="flex-1 bg-black/[0.08] text-black/80 py-3 rounded-[16px] font-semibold text-[0.9375rem]"
                      style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}
                    >
                      Sil
                    </motion.button>
                    
      </div>
                  
      </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Undo Snackbar */}
        <AnimatePresence>
          {undoTask && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black dark:bg-[#2c2c2e] text-white rounded-[16px] px-4 py-3 flex items-center justify-between gap-4 shadow-2xl z-50 w-[90%] max-w-sm"
            >
              <span className="text-[0.8125rem] font-medium text-white/90 line-clamp-1 truncate">
                Görev silindi
              </span>
              <button 
                onClick={handleUndoDelete}
                className="text-emerald-400 font-bold text-[0.8125rem] uppercase tracking-wider px-2 py-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
              >
                Geri Al
              </button>
            </motion.div>
          )}

          {authError && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white rounded-[16px] px-4 py-3 flex items-center justify-between gap-4 shadow-2xl z-50 w-[90%] max-w-md"
            >
              <span className="text-[0.8125rem] font-medium text-white line-clamp-2">
                {authError}
              </span>
              <button 
                onClick={() => setAuthError(null)}
                className="text-white/80 hover:text-white text-xs font-bold uppercase tracking-wider p-1 shrink-0"
              >
                Kapat
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <AiChat isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} />
      </div>
    </div>
  );
}
