import React, { useState, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Clock } from "lucide-react";
import { mockTasks, mockSchedules } from "./data";
import { Task, DaySchedule } from "./types";
import { motion, AnimatePresence } from "motion/react";

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

function TodayView({ tasks, toggleTask, deleteTask, onTaskClick }: { tasks: Task[], toggleTask: (id: string, current: boolean) => void, deleteTask: (id: string) => void, onTaskClick: (task: Task) => void }) {
  const today = new Date();
  const dayName = today.toLocaleDateString("tr-TR", { weekday: "long" });
  const dayNum = today.getDate();
  const monthName = today.toLocaleDateString("tr-TR", { month: "short" }).toUpperCase().replace('.', '');

  return (
    <div className="flex flex-col px-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center mt-8 mb-10">
        <div className="pr-6 border-r border-black/20">
          <h2 className="text-sm font-semibold text-black tracking-wide mb-1 capitalize">
            {dayName}
          </h2>
          <div className="text-[5.5rem] leading-[0.8] font-semibold tracking-tighter text-black">
            {dayNum}
            <br />
            <span className="text-[4rem]">{monthName}</span>
          </div>
        </div>
        <div className="pl-6 space-y-4">
          <div>
            <div className="text-lg font-semibold text-black">13:20</div>
            <div className="text-xs font-medium text-black/60">İstanbul</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-black">10:20</div>
            <div className="text-xs font-medium text-black/60">
              Londra
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-black">Günün Görevleri</h3>
        <button className="text-[10px] bg-[#e5e5e5] text-black/60 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
          Anımsatıcılar
        </button>
      </div>

      <div className="flex flex-col gap-3 pb-12">
        <AnimatePresence mode="popLayout">
          {tasks.map((task) => (
            <motion.div
              key={task.id}
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
                    const threshold = 100;
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
                  const threshold = 100;
                  if (info.offset.x > threshold) {
                    triggerHaptic('success');
                    toggleTask(task.id, !!task.completed);
                  } else if (info.offset.x < -threshold) {
                    triggerHaptic('warning');
                    if (window.confirm('Bu görevi silmek istediğinize emin misiniz?')) {
                      deleteTask(task.id);
                    }
                  }
                }}
                onClick={() => onTaskClick(task)}
                className={`draggable-card rounded-[28px] p-5 relative overflow-hidden flex flex-col justify-between border-2 border-transparent transition-opacity duration-300 ${task.completed ? 'opacity-50 grayscale' : ''}`}
                style={{ backgroundColor: task.color, minHeight: "140px", touchAction: "none" }}
              >
                <div className="flex justify-between items-start pointer-events-none">
                  <h4 className={`text-[1.35rem] font-medium text-black/80 leading-[1.1] whitespace-pre-line tracking-tight ${task.completed ? 'line-through' : ''}`}>
                    {task.title}
                  </h4>
                  <div className="flex -space-x-2">
                    {task.attendees.map((a, i) => (
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
                <div className="flex items-end justify-between mt-6 pointer-events-none">
                  <div>
                    <div className="text-xs font-semibold text-black/80">
                      {task.startTime}
                    </div>
                    <div className="text-[9px] text-black/60 font-semibold uppercase mt-0.5">
                      Başlangıç
                    </div>
                  </div>
                  <div
                    className="text-white text-[10px] px-3 py-1.5 rounded-full font-semibold"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                  >
                    {task.duration}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-black/80">
                      {task.endTime}
                    </div>
                    <div className="text-[9px] text-black/60 font-semibold uppercase mt-0.5">
                      Bitiş
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
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
  
  const getLocalISODate = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Generate days for the current month
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1));
  const colors = ['#b5abd0', '#d6a3a4', '#a0cec9', '#cde4a4', '#e7c57f'];

  const selectedDateTasks = selectedDate ? tasks.filter(t => t.date === getLocalISODate(selectedDate)) : [];

  return (
    <div className="flex flex-col px-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-center justify-between mt-4 mb-6 sticky top-0 bg-[#f4f4f4]/90 backdrop-blur-sm z-10 py-2">
        <span className="text-black/30 font-semibold text-xl tracking-wider w-12">
          {formatMonth(prevMonth)}
        </span>
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(prevMonth)} className="p-2 hover:bg-black/5 rounded-full transition">
            <ChevronLeft className="w-5 h-5 text-black" strokeWidth={3} />
          </button>
          <span className="text-black text-2xl font-semibold tracking-wider w-20 text-center">
            {formatMonth(currentDate)}
          </span>
          <button onClick={() => setCurrentDate(nextMonth)} className="p-2 hover:bg-black/5 rounded-full transition">
            <ChevronRight className="w-5 h-5 text-black" strokeWidth={3} />
          </button>
        </div>
        <span className="text-black/30 font-semibold text-xl tracking-wider w-12 text-right">
          {formatMonth(nextMonth)}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {days.map((dateObj, i) => {
          const day = dateObj.getDate();
          const dayName = dateObj.toLocaleDateString("tr-TR", { weekday: "long" });
          const monthName = formatMonth(dateObj);
          const color = colors[i % colors.length];
          const dateStr = getLocalISODate(dateObj);
          const dayTasks = tasks.filter(t => t.date === dateStr);

          return (
            <div
              key={dateObj.toISOString()}
              onClick={() => setSelectedDate(dateObj)}
              className="rounded-[28px] p-5 flex items-stretch gap-4 relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity active:scale-[0.98]"
              style={{ backgroundColor: color, minHeight: "160px" }}
            >
              <div className="flex flex-col w-20 shrink-0">
                <span className="text-black/60 font-medium text-[13px] capitalize">
                  {dayName}
                </span>
                <span className="text-[3.2rem] font-medium text-black/70 leading-[0.9] -ml-0.5 tracking-tight my-1">
                  {day}
                </span>
                <span className="text-2xl font-medium text-black/60 leading-none">
                  {monthName}
                </span>
              </div>

              <div className="flex-1 relative flex">
                {/* Timeline lines */}
                <div className="absolute inset-y-0 left-0 w-px bg-black/20"></div>
                <div className="absolute inset-y-0 left-1/2 w-px bg-black/20"></div>
                <div className="absolute inset-y-0 right-0 w-px bg-black/20"></div>

                {/* Time markers */}
                <span className="absolute top-0 left-1.5 text-[10px] font-medium text-black/60">
                  15:00
                </span>
                <span className="absolute top-0 left-[calc(50%+6px)] text-[10px] font-medium text-black/60">
                  16:00
                </span>
                <span className="absolute top-0 right-auto left-[calc(100%+6px)] -translate-x-full pr-1.5 text-[10px] font-medium text-black/60">
                  05:00
                </span>

                {/* Events */}
                <div className="absolute top-7 left-1.5 right-1.5 flex flex-col gap-1.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="bg-black/70 text-white text-[10px] px-3 py-1 rounded-full font-semibold tracking-wide truncate max-w-full">
                      {task.startTime} - {task.title.replace('\n', ' ')}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] font-bold text-black/60 pl-2">
                      +{dayTasks.length - 3} daha...
                    </div>
                  )}
                </div>
              </div>
            </div>
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
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                  <h3 className="text-2xl font-semibold text-black tracking-tight">
                    {selectedDate.getDate()} {selectedDate.toLocaleDateString("tr-TR", { month: "long" })}
                  </h3>
                  <p className="text-black/50 font-medium capitalize">{selectedDate.toLocaleDateString("tr-TR", { weekday: "long" })}</p>
                </div>
                <button onClick={() => setSelectedDate(null)} className="p-2 bg-black/5 rounded-full text-black/60 hover:text-black hover:bg-black/10 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-3 pb-8">
                {selectedDateTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 opacity-50">
                    <CalendarIcon className="w-12 h-12 mb-4 text-black/40" />
                    <p className="font-medium text-black/60 text-lg">Bu güne ait görev yok</p>
                  </div>
                ) : (
                  selectedDateTasks.map((task) => (
                    <div 
                      key={task.id} 
                      onClick={() => onTaskClick(task)}
                      className={`rounded-[24px] p-4 flex flex-col justify-between cursor-pointer hover:opacity-90 transition-opacity active:scale-[0.98] ${task.completed ? 'opacity-50 grayscale' : ''}`}
                      style={{ backgroundColor: task.color, minHeight: "100px" }}
                    >
                      <h4 className={`text-xl font-medium text-black/80 leading-tight whitespace-pre-line ${task.completed ? 'line-through' : ''}`}>
                        {task.title}
                      </h4>
                      <div className="flex items-center justify-between mt-4">
                        <span className="bg-black/20 text-black/80 text-[10px] px-3 py-1 rounded-full font-bold">
                          {task.startTime} - {task.endTime}
                        </span>
                        <div className="flex -space-x-2">
                          {task.attendees.map((a, i) => (
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
                    </div>
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
  const [view, setView] = useState<"today" | "calendar">("today");
  const getLocalISODate = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [tasks, setTasks] = useState<Task[]>(() => {
    const todayStr = getLocalISODate(new Date());
    return mockTasks.map(t => ({ ...t, date: todayStr }));
  });
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const toggleTask = (id: string, current: boolean) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !current } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const colors = ['#e7c57f', '#bac5c4', '#b5abd0', '#d6a3a4', '#a0cec9', '#cde4a4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      date: getLocalISODate(new Date()),
      startTime: '16:00',
      endTime: '17:00',
      duration: '1 Sa',
      color: randomColor,
      type: 'task',
      attendees: [],
      completed: false
    };

    setTasks(prev => [newTask, ...prev]);
    setNewTaskTitle('');
    setIsAdding(false);
    triggerHaptic('success');
  };

  return (
    <div className="min-h-screen bg-[#f4f4f4] text-black font-sans selection:bg-black/10 flex justify-center">
      <div className="w-full max-w-md bg-[#f4f4f4] min-h-screen shadow-2xl overflow-hidden flex flex-col relative">
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-12 pb-4 sticky top-0 z-10 bg-[#f4f4f4]/90 backdrop-blur-md">
          <div className="flex items-center bg-transparent rounded-[32px] p-1 border border-black/10">
            <button
              onClick={() => setView("today")}
              className={`px-5 py-2.5 rounded-[24px] text-sm font-semibold transition-colors duration-200 ${
                view === "today"
                  ? "bg-black text-white"
                  : "text-black/60 hover:text-black"
              }`}
            >
              Bugün
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`px-5 py-2.5 rounded-[24px] text-sm font-semibold transition-colors duration-200 ${
                view === "calendar"
                  ? "bg-black text-white"
                  : "text-black/60 hover:text-black"
              }`}
            >
              Takvim
            </button>
          </div>

          <button 
            onClick={() => setIsAdding(true)}
            className="w-11 h-11 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
          >
            <Plus className="w-5 h-5 text-black" strokeWidth={2.5} />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto hide-scrollbar">
          {view === "today" ? (
            <TodayView tasks={tasks.filter(t => t.date === getLocalISODate(new Date()))} toggleTask={toggleTask} deleteTask={deleteTask} onTaskClick={setSelectedTask} />
          ) : (
            <CalendarView tasks={tasks} onTaskClick={setSelectedTask} />
          )}
        </main>

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl mb-4"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-black">Yeni Görev</h3>
                  <button onClick={() => setIsAdding(false)} className="p-2 bg-black/5 rounded-full text-black/60 hover:text-black hover:bg-black/10 transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={addTask} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Ne yapmanız gerekiyor?"
                      className="w-full text-lg border-b-2 border-black/10 bg-transparent py-3 focus:outline-none focus:border-black transition-colors font-medium text-black placeholder-black/30"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newTaskTitle.trim()}
                    className="w-full bg-black text-white rounded-full py-4 font-semibold text-lg disabled:opacity-50 transition-opacity"
                  >
                    Görev Ekle
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task Details Modal */}
        <AnimatePresence>
          {selectedTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
              onClick={() => setSelectedTask(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
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
                <div className="mt-4 mb-8">
                  <h3 className="text-3xl font-medium text-black/80 leading-tight whitespace-pre-line tracking-tight mb-6">
                    {selectedTask.title}
                  </h3>
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-black/70">
                      <Clock className="w-5 h-5" />
                      <span className="font-semibold">{selectedTask.startTime} - {selectedTask.endTime}</span>
                    </div>
                    <div className="flex items-center gap-3 text-black/70">
                      <CalendarIcon className="w-5 h-5" />
                      <span className="font-semibold">{selectedTask.duration} Süre</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      triggerHaptic('medium');
                      toggleTask(selectedTask.id, !!selectedTask.completed);
                      setSelectedTask(null);
                    }}
                    className="flex-1 bg-black/80 text-white py-3 rounded-full font-semibold text-sm hover:bg-black transition-colors"
                  >
                    {selectedTask.completed ? 'Geri Al' : 'Tamamla'}
                  </button>
                  <button 
                    onClick={() => {
                      triggerHaptic('warning');
                      if (window.confirm('Bu görevi silmek istediğinize emin misiniz?')) {
                        deleteTask(selectedTask.id);
                        setSelectedTask(null);
                      }
                    }}
                    className="flex-1 bg-white/40 text-black py-3 rounded-full font-semibold text-sm hover:bg-white/60 transition-colors"
                  >
                    Sil
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
