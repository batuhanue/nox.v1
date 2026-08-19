import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Plus, Trash2 } from 'lucide-react';
import { Task, SubTask } from '../types';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { triggerHaptic } from '../App';

export default function AddTaskModal({ onClose, onAdd }: { onClose: () => void, onAdd: (task: Partial<Task>) => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setStartTimeEnd] = useState('13:00');
  const setEndTime = (val: string) => setStartTimeEnd(val);
  
  const [locationName, setLocationName] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.Place[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [subtasks, setSubtasks] = useState<{title: string}[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  
  const placesLib = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!placesLib || !locationQuery.trim()) {
      setPredictions([]);
      setIsDropdownOpen(false);
      return;
    }
    
    // Use the new Place.searchByText API to avoid legacy widget errors
    const fetchPlaces = async () => {
      try {
        const { places } = await placesLib.Place.searchByText({
          textQuery: locationQuery,
          fields: ['displayName', 'formattedAddress'],
          maxResultCount: 4,
        });
        setPredictions(places || []);
        setIsDropdownOpen((places || []).length > 0);
      } catch (e) {
        console.error("Places API Search Error:", e);
      }
    };
    
    const timer = setTimeout(fetchPlaces, 350); // debounce
    return () => clearTimeout(timer);
  }, [locationQuery, placesLib]);

  const handleSelectPlace = (place: google.maps.places.Place) => {
    const name = place.displayName || place.formattedAddress || '';
    setLocationName(name);
    setLocationQuery(name); // update input visually
    setIsDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    // Calculate simple duration string
    const s = new Date(`1970-01-01T${startTime}:00`);
    const eTime = new Date(`1970-01-01T${endTime}:00`);
    let diffMins = Math.round((eTime.getTime() - s.getTime()) / 60000);
    if (diffMins < 0) diffMins += 24 * 60;
    
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    let durStr = '';
    if (h > 0) durStr += `${h} Sa `;
    if (m > 0) durStr += `${m} Dk`;
    if (!durStr) durStr = '0 Dk';

    onAdd({
      title,
      date,
      startTime,
      endTime,
      duration: durStr.trim(),
      locationName: locationName || undefined,
      subtasks: subtasks.map(s => ({
        id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: s.title,
        completed: false
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
          <button onClick={onClose} className="p-2 bg-black/5 dark:bg-white/5 rounded-full text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 block">Görev Adı</label>
            <input
              type="text"
              autoFocus
              placeholder="Ne yapmanız gerekiyor?"
              className="w-full text-xl border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white placeholder-black/20 dark:placeholder-white/20"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 block">Tarih</label>
              <input
                type="date"
                className="w-full text-[15px] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 block">Başlangıç</label>
                <input
                  type="time"
                  className="w-full text-[15px] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 block">Bitiş</label>
                <input
                  type="time"
                  className="w-full text-[15px] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 relative">
            <label className="text-[11px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Konum (İsteğe Bağlı)
            </label>
            <input
              ref={inputRef}
              type="text"
              placeholder="Google Haritalar'da ara..."
              className="w-full text-[15px] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white placeholder-black/20 dark:placeholder-white/20"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                if (!e.target.value) setLocationName(''); // clear on empty
              }}
              onFocus={() => {
                if (predictions.length > 0) setIsDropdownOpen(true);
              }}
            />
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#2c2c2e] rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-black/[0.04] dark:border-white/[0.04] overflow-hidden z-10 flex flex-col">
                {predictions.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPlace(p)}
                    className="flex flex-col items-start p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-b border-black/[0.04] dark:border-white/[0.04] last:border-b-0 text-left w-full"
                  >
                    <span className="font-semibold text-[14px] text-black/80 dark:text-white/80">{p.displayName}</span>
                    <span className="text-[11px] font-medium text-black/40 dark:text-white/40 mt-0.5 line-clamp-1">{p.formattedAddress}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Subtasks Section */}
          <div className="pt-2">
            <label className="text-[11px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-2 block">Alt Görevler</label>
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
                    <span className="text-[13px] font-medium text-black/80 dark:text-white/80 line-clamp-1">{st.title}</span>
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
                className="flex-1 text-[13px] border-b-2 border-black/5 dark:border-white/5 bg-transparent py-2 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white placeholder-black/20 dark:placeholder-white/20"
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
            className="w-full bg-black dark:bg-white text-white dark:text-black rounded-[16px] py-4 font-semibold text-[17px] disabled:opacity-30 disabled:scale-100 transition-opacity mt-6 shadow-md"
            style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}
          >
            Görev Ekle
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}
