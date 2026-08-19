import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Plus, Trash2 } from 'lucide-react';
import { Task, SubTask } from '../types';
import { triggerHaptic } from '../App';

export default function AddTaskModal({ onClose, onAdd, initialTask }: { onClose: () => void, onAdd: (task: Partial<Task>) => void, initialTask?: Task | null }) {
  const [title, setTitle] = useState(initialTask?.title || '');
  const [date, setDate] = useState(() => {
    if (initialTask?.date) return initialTask.date;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [startTime, setStartTime] = useState(initialTask?.startTime || '12:00');
  const [endTime, setStartTimeEnd] = useState(initialTask?.endTime || '13:00');
  const setEndTime = (val: string) => setStartTimeEnd(val);
  
  const [isAllDay, setIsAllDay] = useState(initialTask?.isAllDay || false);
  const [importance, setImportance] = useState<'normal' | 'important' | 'critical'>(initialTask?.importance || 'normal');
  const [dueDate, setDueDate] = useState(initialTask?.dueDate || '');
  
  const [locationName, setLocationName] = useState(initialTask?.locationName || '');
  
  const [subtasks, setSubtasks] = useState<{id?: string, title: string, completed?: boolean}[]>(initialTask?.subtasks || []);
  const [newSubtask, setNewSubtask] = useState('');
  
  const [reminder, setReminder] = useState<number>(() => {
    if (initialTask?.reminders && initialTask.reminders.length > 0) {
      return initialTask.reminders[0].offset;
    }
    return -60; // 1 Hour before by default
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    let durStr = '';
    let finalStartTime = startTime;
    let finalEndTime = endTime;

    if (isAllDay) {
      finalStartTime = undefined as any;
      finalEndTime = undefined as any;
      durStr = 'Tüm Gün';
    } else {
      // Calculate simple duration string
      const s = new Date(`1970-01-01T${startTime}:00`);
      const eTime = new Date(`1970-01-01T${endTime}:00`);
      let diffMins = Math.round((eTime.getTime() - s.getTime()) / 60000);
      if (diffMins < 0) diffMins += 24 * 60;
      
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      if (h > 0) durStr += `${h} Sa `;
      if (m > 0) durStr += `${m} Dk`;
      if (!durStr) durStr = '0 Dk';
      durStr = durStr.trim();
    }

    onAdd({
      title,
      date,
      dueDate: dueDate || undefined,
      isAllDay,
      importance,
      startTime: finalStartTime,
      endTime: finalEndTime,
      duration: durStr,
      locationName: locationName || undefined,
      reminders: reminder === 1 ? [] : [{ offset: reminder }],
      subtasks: subtasks.map(s => ({
        id: s.id || `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: s.title,
        completed: s.completed || false
      }))
    });
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    triggerHaptic('light');
    setSubtasks([...subtasks, { title: newSubtask.trim() }]);
    setNewSubtask('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ y: "100%", opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: "100%", opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
        className="bg-white dark:bg-[#1c1c1e] w-full max-w-md rounded-[32px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto hide-scrollbar"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-black dark:text-white tracking-tight">Yeni Görev</h3>
          <button aria-label="Kapat" onClick={onClose} className="p-2 bg-black/5 dark:bg-white/5 rounded-full text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 block">Görev Adı</label>
            <input
              type="text"
              autoFocus
              placeholder="Ne yapmanız gerekiyor?"
              className="w-full text-xl border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white placeholder-black/20 dark:placeholder-white/20"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="pt-2">
            <label className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-2 block">Önem Derecesi</label>
            <div className="flex items-center bg-black/5 dark:bg-white/5 p-1 rounded-xl relative w-full">
              {(['normal', 'important', 'critical'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => { triggerHaptic('light'); setImportance(lvl); }}
                  className={`flex-1 relative py-1.5 text-[12px] font-semibold transition-colors duration-300 z-10 ${importance === lvl ? (lvl === 'critical' ? 'text-white' : 'text-black dark:text-white') : 'text-black/50 dark:text-white/50'}`}
                >
                  {importance === lvl && (
                    <motion.div
                      layoutId="importanceTab"
                      className={`absolute inset-0 rounded-lg -z-10 shadow-sm ${lvl === 'critical' ? 'bg-red-500' : lvl === 'important' ? 'bg-orange-400' : 'bg-white dark:bg-[#2c2c2e]'}`}
                      initial={false}
                      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    />
                  )}
                  {lvl === 'normal' ? 'Normal' : lvl === 'important' ? 'Önemli' : 'Kritik'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 block">Planlanan Tarih</label>
              <input
                type="date"
                className="w-full text-[0.9375rem] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 block flex items-center justify-between">
                <span>Son Tarih (İsteğe Bağlı)</span>
              </label>
              <input
                type="date"
                className="w-full text-[0.9375rem] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-b-2 border-black/5 dark:border-white/5 pb-2">
            <label className="text-[0.8125rem] font-bold text-black/80 dark:text-white/80">Tüm Gün</label>
            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setIsAllDay(!isAllDay); }}
              className={`w-11 h-6 rounded-full transition-colors relative ${isAllDay ? 'bg-emerald-500' : 'bg-black/10 dark:bg-white/10'}`}
            >
              <motion.div 
                className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"
                animate={{ x: isAllDay ? 20 : 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              />
            </button>
          </div>

          <AnimatePresence>
            {!isAllDay && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-4 overflow-hidden"
              >
                <div>
                  <label className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 block">Başlangıç</label>
                  <input
                    type="time"
                    className="w-full text-[0.9375rem] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 block">Bitiş</label>
                  <input
                    type="time"
                    className="w-full text-[0.9375rem] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-2 relative">
            <label className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Konum (İsteğe Bağlı)
            </label>
            <input
              type="text"
              placeholder="Konum ekle..."
              className="w-full text-[0.9375rem] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white placeholder-black/20 dark:placeholder-white/20"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>
          
          <div className="pt-2 relative">
            <label className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 block">Hatırlatıcı</label>
            <select
              value={reminder}
              onChange={(e) => setReminder(Number(e.target.value))}
              className="w-full text-[0.9375rem] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white"
            >
              <option value={1}>Hiçbiri</option>
              <option value={0}>Zamanında</option>
              <option value={-15}>15 Dakika Önce</option>
              <option value={-60}>1 Saat Önce</option>
              <option value={-120}>2 Saat Önce</option>
              <option value={-1440}>1 Gün Önce</option>
            </select>
          </div>
          
          {/* Subtasks Section */}
          <div className="pt-2">
            <label className="text-[0.6875rem] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-2 block">Alt Görevler</label>
            <div className="space-y-2 mb-2">
              <AnimatePresence>
                {subtasks.map((st, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-between bg-black/5 dark:bg-white/5 rounded-xl px-3 py-2"
                  >
                    <span className="text-[0.8125rem] font-medium text-black/80 dark:text-white/80 line-clamp-1">{st.title}</span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setSubtasks(subtasks.filter((_, idx) => idx !== i));
                      }}
                      className="p-1.5 text-black/40 hover:text-red-500 dark:text-white/40 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Alt görev ekle..."
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                className="flex-1 text-[0.8125rem] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white placeholder-black/20 dark:placeholder-white/20"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                disabled={!newSubtask.trim()}
                className="p-2 bg-black/5 dark:bg-white/5 rounded-full text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white disabled:opacity-30 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <motion.button
            whileTap={title.trim() ? { scale: 0.96 } : {}}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            type="submit"
            disabled={!title.trim()}
            className="w-full bg-black dark:bg-white text-white dark:text-black rounded-[16px] py-4 font-semibold text-[1.0625rem] disabled:opacity-30 disabled:scale-100 transition-opacity mt-6 shadow-md"
            style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}
          >
            {initialTask ? "Kaydet" : "Görev Ekle"}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}
