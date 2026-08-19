import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Inbox, Clock, Calendar } from 'lucide-react';
import { Task } from '../types';
import { triggerHaptic } from '../App';

export default function InboxView({ tasks, addTask, onTaskClick, toggleTask, deleteTask }: { 
  tasks: Task[], 
  addTask: (title: string) => void,
  onTaskClick: (task: Task) => void,
  toggleTask: (id: string, current: boolean) => void,
  deleteTask: (id: string) => void
}) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      triggerHaptic('success');
      addTask(inputValue.trim());
      setInputValue('');
    }
  };

  const inboxTasks = tasks.filter(t => t.inbox && !t.completed);

  return (
    <div className="flex flex-col px-6 md:px-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="mt-8 mb-10">
        <h2 className="text-3xl font-semibold text-black dark:text-white tracking-tight mb-2">Inbox</h2>
        <p className="text-black/50 dark:text-white/50 text-sm font-medium">
          Aklınıza gelenleri hızlıca kaydedin, daha sonra planlarsınız.
        </p>
      </div>

      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Plus className="w-6 h-6 text-black/30 dark:text-white/30" strokeWidth={2.5} />
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Yeni bir görev ekle ve Enter'a bas..."
          className="w-full bg-white dark:bg-[#1c1c1e] border-2 border-black/5 dark:border-white/5 rounded-2xl py-4 pl-14 pr-4 text-[1.0625rem] font-semibold text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:border-black/20 dark:focus:border-white/20 transition-colors shadow-sm"
        />
      </div>

      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {inboxTasks.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 opacity-50"
            >
              <Inbox className="w-12 h-12 mb-4 text-black/40 dark:text-white/40" />
              <p className="font-medium text-black/60 dark:text-white/60 text-lg">Inbox boş</p>
            </motion.div>
          ) : (
            inboxTasks.map(task => (
              <motion.div
                layout
                key={task.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { triggerHaptic('light'); onTaskClick(task); }}
                className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('success');
                      toggleTask(task.id, !!task.completed);
                    }}
                    className="w-6 h-6 rounded-full border-2 border-black/20 dark:border-white/20 flex items-center justify-center hover:border-black dark:hover:border-white transition-colors"
                  />
                  <h4 className="text-[1.0625rem] font-semibold text-black/90 dark:text-white/90 leading-tight">
                    {task.title}
                  </h4>
                </div>
                {/* Visual indicator that it is unscheduled */}
                <div className="px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-lg text-[0.6875rem] font-bold text-black/40 dark:text-white/40 tracking-wider uppercase flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Planlanmadı
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
