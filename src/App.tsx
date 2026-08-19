import React, { useState, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock, MapPin, LogOut, Settings, Moon, Sun } from "lucide-react";
import { mockTasks, mockSchedules } from "./data";
import { Task, DaySchedule } from "./types";
import { motion, AnimatePresence } from "motion/react";
import AddTaskModal from "./components/AddTaskModal";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where, setDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";

import CanvasView from "./components/CanvasView";

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

const checkNotifications = (tasks: Task[]) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const notifiedStr = localStorage.getItem('notifiedTasks') || '{}';
  let notified: Record<string, { day: boolean, hour: boolean }> = {};
  try {
    notified = JSON.parse(notifiedStr);
  } catch (e) {
    notified = {};
  }
  
  const now = Date.now();
  let updated = false;

  tasks.forEach(task => {
    if (task.completed) return;
    if (!task.date || !task.startTime || !task.date.includes('-') || !task.startTime.includes(':')) return;

    const [y, m, d] = task.date.split('-');
    const [H, M] = task.startTime.split(':');
    const taskTime = new Date(Number(y), Number(m) - 1, Number(d), Number(H), Number(M)).getTime();
    
    const timeDiff = taskTime - now;
    
    if (!notified[task.id]) notified[task.id] = { day: false, hour: false };

    // 1 Day = 86400000ms. Trigger if between 23h59m and 24h away (within the current minute loop to be precise, or just if it crossed the 24h mark)
    // To be robust against the app being closed, we check if time is less than 24h away and greater than 0, and not notified yet.
    if (timeDiff > 0 && timeDiff <= 86400000 && !notified[task.id].day) {
      new Notification("Yarın Görev Var", {
        body: `Yarın: ${task.title} (${task.startTime})`,
      });
      notified[task.id].day = true;
      updated = true;
    }

    // 1 Hour = 3600000ms. Trigger if less than 1 hour away.
    if (timeDiff > 0 && timeDiff <= 3600000 && !notified[task.id].hour) {
      new Notification("Görev Vakti Yaklaşıyor", {
        body: `1 saatten az kaldı: ${task.title} (${task.startTime})`,
      });
      notified[task.id].hour = true;
      updated = true;
    }
  });

  if (updated) {
    localStorage.setItem('notifiedTasks', JSON.stringify(notified));
  }
};

function useTaskNotifications(tasks: Task[]) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const requestPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        triggerHaptic('success');
        checkNotifications(tasks);
      }
    }
  };

  useEffect(() => {
    if (permission === 'granted' && tasks.length > 0) {
      checkNotifications(tasks); // Check on mount/update
      const interval = setInterval(() => checkNotifications(tasks), 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [tasks, permission]);

  return { permission, requestPermission };
}

function TaskCard({ task, toggleTask, deleteTask, onTaskClick }: { task: Task, toggleTask: (id: string, current: boolean) => void, deleteTask: (id: string) => void, onTaskClick: (task: Task) => void }) {
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
            const threshold = 120;
            const passed = Math.abs(info.offset.x) > threshold;
            const currentlyPassed = el.dataset.passed === 'true';

            if (passed && !currentlyPassed) {
              el.dataset.passed = 'true';
              triggerHaptic('medium');
            } else if (!passed && currentlyPassed) {
              el.dataset.passed = 'false';
              triggerHaptic('light');
            }

            if (info.offset.x > 0) {
              // Swipe Right -> Complete
              const opacity = Math.min(info.offset.x / threshold, 1) * 0.5;
              el.style.boxShadow = passed ? `inset 0 0 40px rgba(16, 185, 129, 0.4), 0 0 20px rgba(16, 185, 129, 0.6)` : `inset 0 0 20px rgba(16, 185, 129, ${opacity})`;
              el.style.borderColor = `rgba(16, 185, 129, ${passed ? 0.8 : opacity * 0.5})`;
            } else if (info.offset.x < 0) {
              // Swipe Left -> Delete
              const opacity = Math.min(-info.offset.x / threshold, 1) * 0.5;
              el.style.boxShadow = passed ? `inset 0 0 40px rgba(239, 68, 68, 0.4), 0 0 20px rgba(239, 68, 68, 0.6)` : `inset 0 0 20px rgba(239, 68, 68, ${opacity})`;
              el.style.borderColor = `rgba(239, 68, 68, ${passed ? 0.8 : opacity * 0.5})`;
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
          const threshold = 120;
          if (info.offset.x > threshold) {
            triggerHaptic('success');
            toggleTask(task.id, !!task.completed);
          } else if (info.offset.x < -threshold) {
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
          <h4 className={`text-[22px] font-semibold text-black/90 leading-[1.1] whitespace-pre-line tracking-tight ${task.completed ? 'line-through' : ''}`}>
            {task.title}
          </h4>
          <div className="flex -space-x-2 shrink-0 ml-4">
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
        <div className="flex items-end justify-between mt-8 pointer-events-none">
          <div>
            <div className="text-[13px] font-bold text-black/80 tracking-wide">
              {task.startTime}
            </div>
            <div className="text-[10px] text-black/50 font-bold uppercase mt-1 tracking-wider">
              Başlangıç
            </div>
          </div>
          <div
            className="text-white text-[11px] px-3.5 py-1.5 rounded-full font-bold tracking-wide"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            {task.duration}
          </div>
          <div className="text-right">
            <div className="text-[13px] font-bold text-black/80 tracking-wide">
              {task.endTime}
            </div>
            <div className="text-[10px] text-black/50 font-bold uppercase mt-1 tracking-wider">
              Bitiş
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TodayView({ tasks, toggleTask, deleteTask, onTaskClick, notificationPermission, onRequestPermission }: { tasks: Task[], toggleTask: (id: string, current: boolean) => void, deleteTask: (id: string) => void, onTaskClick: (task: Task) => void, notificationPermission: NotificationPermission, onRequestPermission: () => void }) {
  const today = new Date();
  const dayName = today.toLocaleDateString("tr-TR", { weekday: "long" });
  const dayNum = today.getDate();
  const monthName = today.toLocaleDateString("tr-TR", { month: "short" }).toUpperCase().replace('.', '');

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
  const weekLabels = ["Pzt", "Sal", "Çar", "Per", "Cum"];
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

    const percentage = Math.min((totalHours / maxHoursPerDay) * 100, 100);
    return { label: weekLabels[i], percentage, totalHours };
  });

  const totalWeekHours = weekData.reduce((acc, curr) => acc + curr.totalHours, 0);
  const overallPercentage = Math.round(Math.min((totalWeekHours / (5 * maxHoursPerDay)) * 100, 100));

  return (
    <div className="flex flex-col px-6 md:px-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mt-8 mb-10">
        <div className="pr-6 md:pr-10 border-r border-black/10 shrink-0">
          <h2 className="text-sm font-semibold text-black dark:text-white tracking-wide mb-1 capitalize">
            {dayName}
          </h2>
          <div className="text-[5.5rem] leading-[0.8] font-semibold tracking-tighter text-black dark:text-white">
            {dayNum}
            <br />
            <span className="text-[4rem]">{monthName}</span>
          </div>
        </div>
        
        <div className="pl-6 md:pl-10 flex flex-col items-end justify-center flex-1">
          <div className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-4">Haftalık Yoğunluk</div>
          <div className="flex items-end gap-3 md:gap-4 h-16 mb-2">
            {weekData.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-2.5 md:w-3 h-14 bg-black/5 dark:bg-white/5 rounded-full relative overflow-hidden flex items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${day.percentage}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 1.2, delay: i * 0.1 }}
                    className="w-full bg-black dark:bg-white rounded-full"
                  />
                </div>
                <span className="text-[10px] font-bold text-black/30 dark:text-white/30">{day.label}</span>
              </div>
            ))}
          </div>
          <div className="text-xl md:text-2xl font-bold tracking-tight text-black dark:text-white mt-1">
            %{overallPercentage}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-black dark:text-white">Günün Görevleri</h3>
        <button 
          onClick={() => {
            triggerHaptic('light');
            onRequestPermission();
          }}
          className={`text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider transition-colors ${
            notificationPermission === 'granted' 
              ? 'bg-black dark:bg-white text-white dark:text-black' 
              : 'bg-[#e5e5e5] dark:bg-[#1c1c1e] text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'
          }`}
        >
          {notificationPermission === 'granted' ? 'Anımsatıcılar Açık' : 
           notificationPermission === 'denied' ? 'Bildirimler Engellendi' : 
           'Anımsatıcıları Aç'}
        </button>
      </div>

      <div className="flex flex-col gap-3 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {tasks.filter(t => t.date === getLocalISODate(today)).map((task) => (
              <TaskCard key={task.id} task={task} toggleTask={toggleTask} deleteTask={deleteTask} onTaskClick={onTaskClick} />
            ))}
          </AnimatePresence>
        </div>
        
        {Object.entries(
          tasks
            .filter(t => t.date > getLocalISODate(today))
            .reduce((acc, task) => {
              if (!acc[task.date]) acc[task.date] = [];
              acc[task.date].push(task);
              return acc;
            }, {} as Record<string, Task[]>)
        )
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([dateStr, dayTasks]) => {
          const d = new Date(dateStr);
          const formattedDay = d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
          
          return (
            <div key={dateStr} className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-black dark:text-white capitalize">{formattedDay}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {dayTasks.map((task) => (
                    <TaskCard key={task.id} task={task} toggleTask={toggleTask} deleteTask={deleteTask} onTaskClick={onTaskClick} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
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
        <span className="text-black/30 dark:text-white/30 font-semibold text-[17px] tracking-wide w-12 cursor-pointer" onClick={() => setCurrentDate(prevMonth)}>
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
        <span className="text-black/30 dark:text-white/30 font-semibold text-[17px] tracking-wide w-12 text-right cursor-pointer" onClick={() => setCurrentDate(nextMonth)}>
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
                <span className="text-black/50 font-bold text-[11px] uppercase tracking-widest">
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
                    <div key={task.id} className="bg-black text-white text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide truncate max-w-full">
                      {task.startTime} - {task.title.replace('\n', ' ')}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] font-bold text-black/50 pl-2">
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
                <button onClick={() => setSelectedDate(null)} className="p-2 bg-black/5 dark:bg-white/5 rounded-full text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition">
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
                        <span className="bg-black/20 text-black/80 text-[10px] px-3 py-1 rounded-full font-bold">
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

export default function App() {
  const [view, setView] = useState<"today" | "calendar" | "kanvas">("today");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  
  const { permission: notificationPermission, requestPermission: onRequestPermission } = useTaskNotifications(tasks);

  // Auth Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

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

  const toggleTask = async (id: string, current: boolean) => {
    if (!user) return;
    try {
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
    try {
      const taskRef = doc(db, `users/${user.uid}/tasks`, id);
      await deleteDoc(taskRef);
      triggerHaptic('success');
    } catch (e) {
      console.error("Error deleting task:", e);
    }
  };

  const handleAddTask = async (taskData: Partial<Task>) => {
    if (!user) return;
    const colors = ['#e7c57f', '#bac5c4', '#b5abd0', '#d6a3a4', '#a0cec9', '#cde4a4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const taskId = Date.now().toString(); // Use as custom doc ID
    const newTask = {
      title: taskData.title || '',
      date: taskData.date || getLocalISODate(new Date()),
      startTime: taskData.startTime || '12:00',
      endTime: taskData.endTime || '13:00',
      duration: taskData.duration || '1 Sa',
      color: randomColor,
      type: 'task',
      completed: false,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    if (taskData.locationName) {
      (newTask as any).locationName = taskData.locationName;
    }

    try {
      const taskRef = doc(db, `users/${user.uid}/tasks`, taskId);
      await setDoc(taskRef, newTask);
      setIsAdding(false);
      triggerHaptic('success');
    } catch (e) {
      console.error("Error adding task:", e);
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
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
            <p className="text-black/50 text-center text-[15px] max-w-[280px] mb-12 font-medium leading-relaxed">
              Günlük görevlerinizi şık ve akıcı bir biçimde yönetin.
            </p>
            
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleLogin}
              className="bg-white text-black border border-black/10 shadow-sm rounded-full py-3.5 px-8 flex items-center gap-3 font-semibold text-[15px] hover:bg-black/5 transition-colors w-full justify-center"
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
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f4] dark:bg-[#121212] text-black dark:text-white font-sans selection:bg-black/10 dark:selection:bg-white/10 transition-colors duration-300">
      <div className="w-full max-w-5xl mx-auto min-h-screen flex flex-col relative">
        {/* Header */}
        <header className="flex items-center justify-between px-6 md:px-10 pt-12 md:pt-10 pb-4 sticky top-0 z-20 bg-[#f4f4f4]/80 dark:bg-[#121212]/80 backdrop-blur-xl border-b border-black/[0.03] dark:border-white/[0.03]">
          <div className="flex items-center bg-black/[0.06] dark:bg-white/[0.06] p-[3px] rounded-full relative">
            {(["today", "calendar", "kanvas"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { triggerHaptic('light'); setView(tab); }}
                className={`relative px-3 sm:px-5 py-1.5 sm:py-2 text-[11px] sm:text-[13px] tracking-wide font-semibold z-10 transition-colors duration-300 ${
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
                {tab === "today" ? "Bugün" : tab === "calendar" ? "Takvim" : "Kanvas"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 relative">
            <motion.button 
              whileTap={{ scale: 0.88 }}
              onClick={() => { triggerHaptic('light'); setIsSettingsOpen(!isSettingsOpen); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition ${isSettingsOpen ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : 'text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              <Settings className="w-5 h-5" />
            </motion.button>

            <AnimatePresence>
              {isSettingsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsSettingsOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    className="absolute top-12 right-12 mt-2 w-48 bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-xl border border-black/5 dark:border-white/5 p-2 z-40"
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
                      <span className="text-[13px] font-semibold text-black/80 dark:text-white/80">
                        {isDarkMode ? 'Açık Mod' : 'Koyu Mod'}
                      </span>
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
                      <span className="text-[13px] font-semibold">Çıkış Yap</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <motion.button 
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

        {/* Content */}
        <main className="flex-1 pb-10">
          {view === "today" ? (
            <TodayView 
              tasks={tasks} 
              toggleTask={toggleTask} 
              deleteTask={deleteTask} 
              onTaskClick={setSelectedTask} 
              notificationPermission={notificationPermission}
              onRequestPermission={onRequestPermission}
            />
          ) : view === "calendar" ? (
            <CalendarView tasks={tasks} onTaskClick={setSelectedTask} />
          ) : (
            <CanvasView tasks={tasks} onTaskClick={setSelectedTask} onAddRequest={() => setIsAdding(true)} onClose={() => setView('today')} />
          )}
        </main>

        <AnimatePresence>
          {isAdding && (
            <AddTaskModal onClose={() => setIsAdding(false)} onAdd={handleAddTask} />
          )}
        </AnimatePresence>

        {/* Task Details Modal */}
        <AnimatePresence>
          {selectedTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
              onClick={() => setSelectedTask(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
                className="w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative overflow-hidden"
                style={{ backgroundColor: selectedTask.color }}
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => setSelectedTask(null)} 
                  className="absolute top-4 right-4 p-2 bg-black/10 rounded-full text-black/60 hover:text-black transition"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="mt-2 mb-8">
                  <h3 className="text-[28px] font-semibold text-black/90 leading-[1.1] whitespace-pre-line tracking-tight mb-8">
                    {selectedTask.title}
                  </h3>
                  
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center gap-3.5 text-black/70">
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-black/60" />
                      </div>
                      <span className="font-semibold tracking-wide">{selectedTask.startTime} - {selectedTask.endTime}</span>
                    </div>
                    <div className="flex items-center gap-3.5 text-black/70">
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                        <CalendarIcon className="w-4 h-4 text-black/60" />
                      </div>
                      <span className="font-semibold tracking-wide">{selectedTask.duration} Süre</span>
                    </div>
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
                        <h5 className="text-[11px] font-bold text-black/40 uppercase tracking-widest mb-3">Alt Görevler</h5>
                        <div className="flex flex-col gap-2">
                          {selectedTask.subtasks.map((st) => (
                            <button 
                              key={st.id} 
                              onClick={() => {
                                triggerHaptic('light');
                                const updatedSubtasks = selectedTask.subtasks!.map(s => s.id === st.id ? { ...s, completed: !s.completed } : s);
                                // We need to update this task in the database.
                                // Calling a global function or direct update here.
                                // Instead of a full update flow, let's dispatch an event or do it inline
                                import('./firebase').then(({ db, auth }) => {
                                  import('firebase/firestore').then(({ doc, updateDoc }) => {
                                    const user = auth.currentUser;
                                    if (user) {
                                      updateDoc(doc(db, `users/${user.uid}/tasks/${selectedTask.id}`), {
                                        subtasks: updatedSubtasks
                                      });
                                    }
                                  });
                                });
                                setSelectedTask({ ...selectedTask, subtasks: updatedSubtasks });
                              }}
                              className="flex items-center gap-2 text-left hover:bg-black/5 p-1 rounded-lg transition-colors"
                            >
                              <div className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${st.completed ? 'bg-black border-black text-white' : 'border-black/20'}`}>
                                {st.completed && <CheckCircle2 className="w-3 h-3" />}
                              </div>
                              <span className={`text-[13px] font-semibold text-black/80 ${st.completed ? 'line-through opacity-50' : ''}`}>{st.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    onClick={() => {
                      triggerHaptic('medium');
                      toggleTask(selectedTask.id, !!selectedTask.completed);
                      setSelectedTask(null);
                    }}
                    className="flex-1 bg-black text-white py-3 rounded-[16px] font-semibold text-[15px]"
                    style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}
                  >
                    {selectedTask.completed ? 'Geri Al' : 'Tamamla'}
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    onClick={() => {
                      triggerHaptic('warning');
                      if (window.confirm('Bu görevi silmek istediğinize emin misiniz?')) {
                        deleteTask(selectedTask.id);
                        setSelectedTask(null);
                      }
                    }}
                    className="flex-1 bg-black/[0.08] text-black/80 py-3 rounded-[16px] font-semibold text-[15px]"
                    style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}
                  >
                    Sil
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
