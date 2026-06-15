/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Check, ChevronLeft, X, LogIn, LogOut, Search, Volume2, VolumeX, Settings, BarChart2, Calendar, Share2, Copy, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import StatsOverlay from './components/StatsOverlay';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  orderBy,
  getDocs
} from 'firebase/firestore';

import { addEventToGoogleCalendar } from './lib/calendar';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FlatTask {
  id: string;
  title: string;
  completed: boolean;
  parentId: string | null;
  userId: string;
  createdAt: any;
  dueDate: string | null;
  priority?: 'low' | 'medium' | 'high' | null;
  order?: number;
}

let audioCtx: AudioContext | null = null;

const playSubtleSound = (type: 'add' | 'complete' | 'delete', isEnabled: boolean) => {
  if (!isEnabled) return;
  
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  const now = audioCtx.currentTime;
  
  if (type === 'add') {
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'complete') {
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.05, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'delete') {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.02, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    osc.start(now);
    osc.stop(now + 0.1);
  }
};

interface TreeTask extends FlatTask {
  subtasks: TreeTask[];
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [flatTasks, setFlatTasks] = useState<FlatTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigationStack, setNavigationStack] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickInputValue, setQuickInputValue] = useState('');
  const [quickDueDateValue, setQuickDueDateValue] = useState('');
  const [quickPriorityValue, setQuickPriorityValue] = useState<'low' | 'medium' | 'high' | null>(null);
  const [quickAddTargetRoot, setQuickAddTargetRoot] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [bgColor, setBgColor] = useState(() => localStorage.getItem('nox_bgColor') || '#000000');
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('nox_themeColor') || '#ffffff');
  const [autoLightMode, setAutoLightMode] = useState(() => localStorage.getItem('nox_autoLight') === 'true');
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => localStorage.getItem('nox_sound') !== 'false');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'high' | 'medium' | 'low' | 'completed' | 'uncompleted'>('all');
  const [inputValue, setInputValue] = useState('');
  const [dueDateValue, setDueDateValue] = useState('');
  const [priorityValue, setPriorityValue] = useState<'low' | 'medium' | 'high' | null>(null);
  const [direction, setDirection] = useState(1);
  const [longPressedTask, setLongPressedTask] = useState<TreeTask | null>(null);
  const isDraggingRef = useRef(false);
  
  // States and refs for Calendar view
  const [isCalendarView, setIsCalendarView] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth()); // 0-11
  const [longPressedCalendarDay, setLongPressedCalendarDay] = useState<{ dayStr: string; tasks: TreeTask[] } | null>(null);

  const calendarPressTimerRef = useRef<any>(null);
  const isCalendarLongPressTriggered = useRef(false);

  const todayDateStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  }, []);

  const handleCalendarDayPointerDown = (dayStr: string, dayTasks: TreeTask[]) => {
    isCalendarLongPressTriggered.current = false;
    if (dayTasks.length === 0) return;
    calendarPressTimerRef.current = setTimeout(() => {
      isCalendarLongPressTriggered.current = true;
      setLongPressedCalendarDay({ dayStr, tasks: dayTasks });
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(60); 
      }
    }, 350);
  };

  const clearCalendarDayLongPress = () => {
    if (calendarPressTimerRef.current) {
      clearTimeout(calendarPressTimerRef.current);
    }
  };
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pressTimerRef = useRef<NodeJS.Timeout>();
  const isLongPressTriggered = useRef(false);
  
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage({ text, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const triggerFeedback = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(5); // Soft haptic pulse
    }
  };

  const handlePointerDown = (task: TreeTask) => {
    isLongPressTriggered.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      setLongPressedTask(task);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(60); // Sert ve uzun tek tıklık
      }
    }, 350);
  };

  const clearLongPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
  };

  const handleTaskClick = (task: TreeTask) => {
    clearLongPress();
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false; // reset for next time
      return;
    }
    triggerFeedback();
    navigateIn(task.id);
  };

  const isDaytime = useMemo(() => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18;
  }, []);

  const currentBg = (autoLightMode && isDaytime) ? '#ffffff' : bgColor;
  const currentTheme = (autoLightMode && isDaytime) ? '#000000' : themeColor;

  const triggerConfetti = () => {
    confetti({
      particleCount: 60,
      spread: 45,
      origin: { y: 0.8 },
      colors: [currentTheme, '#888888', '#aaaaaa', '#555555', '#dddddd'],
      ticks: 120,
      gravity: 1.2,
      scalar: 0.7,
    });
  };

  useEffect(() => {
    document.documentElement.style.setProperty('--bg-color', currentBg);
    document.documentElement.style.setProperty('--theme-color', currentTheme);
  }, [currentBg, currentTheme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setFlatTasks([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FlatTask));
      const sorted = [...data].sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 0;
        const orderB = b.order !== undefined ? b.order : 0;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setFlatTasks(sorted);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return unsubscribe;
  }, [user]);

  // Load user settings
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.bgColor) {
          setBgColor(data.bgColor);
          localStorage.setItem('nox_bgColor', data.bgColor);
        }
        if (data.themeColor) {
          setThemeColor(data.themeColor);
          localStorage.setItem('nox_themeColor', data.themeColor);
        }
        if (data.autoLightMode !== undefined) {
          setAutoLightMode(data.autoLightMode);
          localStorage.setItem('nox_autoLight', data.autoLightMode.toString());
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });
    return unsubscribe;
  }, [user]);

  // Save user settings (debounced)
  useEffect(() => {
    if (!user) return;
    const timeout = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          bgColor,
          themeColor,
          autoLightMode,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        // Silently catch or handle
        console.error("Error saving settings:", error);
      }
    }, 1000); // 1s debounce to avoid quota limit hits during color dragging
    return () => clearTimeout(timeout);
  }, [bgColor, themeColor, autoLightMode, user]);

  // Keyboard Shortcuts for Common Actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.hasAttribute('contenteditable')
      );

      // 1. Escape Key (works even when typing to dismiss overlays)
      if (e.key === 'Escape') {
        let closedSomething = false;
        if (isAdding) {
          setIsAdding(false);
          closedSomething = true;
        }
        if (isQuickAddOpen) {
          setIsQuickAddOpen(false);
          closedSomething = true;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          closedSomething = true;
        }
        if (isStatsOpen) {
          setIsStatsOpen(false);
          closedSomething = true;
        }
        if (longPressedTask) {
          setLongPressedTask(null);
          closedSomething = true;
        }
        if (longPressedCalendarDay) {
          setLongPressedCalendarDay(null);
          closedSomething = true;
        }
        if (isSearching) {
          setIsSearching(false);
          setSearchQuery('');
          closedSomething = true;
        }
        if (closedSomething) {
          e.preventDefault();
          triggerFeedback();
        }
        return;
      }

      // If typing in any input field or textarea, do not trigger other shortcuts
      if (isTyping) return;

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;

      // 2. Open New Task Dialog: 'Ctrl + N', 'Alt + N', 'n', or 'N'
      if ((isCtrlOrMeta && e.key?.toLowerCase() === 'n') || (isAlt && e.key?.toLowerCase() === 'n') || e.key?.toLowerCase() === 'n') {
        e.preventDefault();
        triggerFeedback();
        setIsAdding(true);
        return;
      }

      // 3. Toggle Search Overlay: 'Ctrl + K', 'Alt + K', '/', 's', or 'S'
      if ((isCtrlOrMeta && e.key?.toLowerCase() === 'k') || (isAlt && e.key?.toLowerCase() === 'k') || e.key === '/' || e.key?.toLowerCase() === 's') {
        e.preventDefault();
        triggerFeedback();
        if (isSearching) {
          setIsSearching(false);
          setSearchQuery('');
        } else {
          setIsSearching(true);
          setTimeout(() => {
            const searchInput = document.querySelector('input[placeholder*="ARA"]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
              searchInput.select();
            }
          }, 50);
        }
        return;
      }

      // 4. Toggle Settings: 'Alt + S', 'Alt + I', 'i', 'I', or ',' (comma)
      if ((isAlt && e.key?.toLowerCase() === 's') || (isAlt && e.key?.toLowerCase() === 'i') || e.key?.toLowerCase() === 'i' || e.key === ',') {
        e.preventDefault();
        triggerFeedback();
        setIsSettingsOpen(prev => !prev);
        return;
      }

      // 5. Toggle Stats: 'Alt + A', 'Alt + O', 'a', or 'A'
      if ((isAlt && e.key?.toLowerCase() === 'a') || (isAlt && e.key?.toLowerCase() === 'o') || e.key?.toLowerCase() === 'a') {
        e.preventDefault();
        triggerFeedback();
        setIsStatsOpen(prev => !prev);
        return;
      }

      // 6. Navigate Back: Backspace or ArrowLeft (when nested inside subgroups)
      if ((e.key === 'Backspace' || e.key === 'ArrowLeft') && navigationStack.length > 0) {
        e.preventDefault();
        triggerFeedback();
        navigateBack();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdding, isQuickAddOpen, isSettingsOpen, isStatsOpen, longPressedTask, isSearching, navigationStack]);

  const taskTree = useMemo(() => {
    const list = JSON.parse(JSON.stringify(flatTasks)) as TreeTask[];
    const map: Record<string, TreeTask> = {};
    const root: TreeTask[] = [];

    list.forEach(task => {
      task.subtasks = [];
      map[task.id] = task;
    });

    list.forEach(task => {
      if (task.parentId && map[task.parentId]) {
        map[task.parentId].subtasks.push(task);
      } else {
        root.push(task);
      }
    });

    return root;
  }, [flatTasks]);

  const getCurrentCollection = (): TreeTask[] => {
    let current = taskTree;
    for (const id of navigationStack) {
      const found = flatTasks.find(t => t.id === id);
      if (found) {
        const treeFound = listToTreeFind(taskTree, id);
        if (treeFound) current = treeFound.subtasks;
      }
    }
    return current;
  };

  const listToTreeFind = (tree: TreeTask[], id: string): TreeTask | null => {
    for (const node of tree) {
      if (node.id === id) return node;
      if (node.subtasks.length > 0) {
        const found = listToTreeFind(node.subtasks, id);
        if (found) return found;
      }
    }
    return null;
  };

  const currentTask = useMemo(() => {
    if (navigationStack.length === 0) return null;
    const lastId = navigationStack[navigationStack.length - 1];
    return flatTasks.find(t => t.id === lastId) || null;
  }, [navigationStack, flatTasks]);

  const getActiveTitle = () => {
    if (!currentTask) return 'GÖREVLER';
    return currentTask.title.toLocaleUpperCase('tr-TR');
  };

  const stats = useMemo(() => {
    const current = getCurrentCollection();
    const completed = current.filter(t => t.completed).length;
    return { completed, total: current.length };
  }, [navigationStack, taskTree]);

  const toggleSound = () => {
    const newVal = !isSoundEnabled;
    setIsSoundEnabled(newVal);
    localStorage.setItem('nox_sound', newVal.toString());
    if (newVal) playSubtleSound('complete', true);
  };

  const addTask = async () => {
    if (!inputValue.trim() || !user) return;
    const parentId = navigationStack.length > 0 ? navigationStack[navigationStack.length - 1] : null;
    
    try {
      const payload: any = {
        title: inputValue.trim(),
        completed: false,
        userId: user.uid,
        parentId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (dueDateValue) {
        payload.dueDate = dueDateValue;
      }
      if (priorityValue) {
        payload.priority = priorityValue;
      }
      
      await addDoc(collection(db, 'tasks'), payload);
      
      if (dueDateValue) {
        addEventToGoogleCalendar(payload.title, payload.priority || null, dueDateValue);
      }

      playSubtleSound('add', isSoundEnabled);
      setInputValue('');
      setDueDateValue('');
      setPriorityValue(null);
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const addQuickTask = async () => {
    if (!quickInputValue.trim() || !user) return;
    const parentId = (!quickAddTargetRoot && navigationStack.length > 0)
      ? navigationStack[navigationStack.length - 1]
      : null;
    
    try {
      const payload: any = {
        title: quickInputValue.trim(),
        completed: false,
        userId: user.uid,
        parentId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (quickDueDateValue) {
        payload.dueDate = quickDueDateValue;
      }
      if (quickPriorityValue) {
        payload.priority = quickPriorityValue;
      }
      
      await addDoc(collection(db, 'tasks'), payload);
      
      if (quickDueDateValue) {
        addEventToGoogleCalendar(payload.title, payload.priority || null, quickDueDateValue);
      }

      playSubtleSound('add', isSoundEnabled);
      setQuickInputValue('');
      setQuickDueDateValue('');
      setQuickPriorityValue(null);
      setIsQuickAddOpen(false);
      showToast('Hızlı görev başarıyla oluşturuldu.', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        completed: !currentStatus,
        updatedAt: serverTimestamp(),
      });
      if (!currentStatus) {
        playSubtleSound('complete', isSoundEnabled);
        triggerConfetti();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const updateTaskPriority = async (taskId: string, priority: 'low' | 'medium' | 'high' | null) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        priority,
        updatedAt: serverTimestamp(),
      });
      showToast('Görev önceliği güncellendi.', 'success');
      // Update our longPressedTask state to sync the modal UI
      if (longPressedTask && longPressedTask.id === taskId) {
        setLongPressedTask(prev => prev ? { ...prev, priority } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const updateTaskDueDate = async (taskId: string, dueDate: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        dueDate: dueDate || null,
        updatedAt: serverTimestamp(),
      });
      showToast('Görev tarihi güncellendi.', 'success');
      // Update our longPressedTask state to sync the modal UI
      if (longPressedTask && longPressedTask.id === taskId) {
        setLongPressedTask(prev => prev ? { ...prev, dueDate: dueDate || null } : null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleCopyTaskText = (task: TreeTask) => {
    triggerFeedback();
    
    let priorityText = '';
    if (task.priority === 'high') priorityText = ' [YÜKSEK ÖNCELİK]';
    else if (task.priority === 'medium') priorityText = ' [ORTA ÖNCELİK]';
    else if (task.priority === 'low') priorityText = ' [DÜŞÜK ÖNCELİK]';

    const dateText = task.dueDate ? ` (📅 Bitiş: ${task.dueDate})` : '';
    
    let subtasksText = '';
    if (task.subtasks && task.subtasks.length > 0) {
      subtasksText = '\nAlt Görevler:\n' + task.subtasks.map(s => `  ${s.completed ? '✓' : '○'} ${s.title}`).join('\n');
    }

    const shareContent = `📌 ${task.title}${priorityText}${dateText}${subtasksText}`;
    
    navigator.clipboard.writeText(shareContent)
      .then(() => {
        showToast('Görev metni kopyalandı.', 'success');
      })
      .catch(() => {
        showToast('Kopyalama başarısız oldu.', 'error');
      });
  };

  const handleNativeShareTask = async (task: TreeTask) => {
    triggerFeedback();
    
    let priorityText = '';
    if (task.priority === 'high') priorityText = ' [YÜKSEK ÖNCELİK]';
    else if (task.priority === 'medium') priorityText = ' [ORTA ÖNCELİK]';
    else if (task.priority === 'low') priorityText = ' [DÜŞÜK ÖNCELİK]';

    const dateText = task.dueDate ? ` (📅 Bitiş: ${task.dueDate})` : '';
    
    let subtasksText = '';
    if (task.subtasks && task.subtasks.length > 0) {
      subtasksText = '\nAlt Görevler:\n' + task.subtasks.map(s => `  ${s.completed ? '✓' : '○'} ${s.title}`).join('\n');
    }

    const shareContent = `📌 ${task.title}${priorityText}${dateText}${subtasksText}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: task.title,
          text: shareContent,
        });
        showToast('Görev paylaşıldı.', 'success');
      } catch (err) {
        console.log('Share API error or cancelled', err);
      }
    } else {
      handleCopyTaskText(task);
    }
  };

  const deleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      playSubtleSound('delete', isSoundEnabled);
      // Also delete subtasks recursively (simplified: delete immediate children or just the item)
      // For a robust app, we'd delete all descendants.
      const descendants = getDescendants(taskId, flatTasks);
      const batch = [taskId, ...descendants];
      
      for(const id of batch) {
        await deleteDoc(doc(db, 'tasks', id));
      }
      
      // If we are currently in this task's view, go back
      if (navigationStack.includes(taskId)) {
        setNavigationStack(prev => prev.slice(0, prev.indexOf(taskId)));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const getDescendants = (id: string, list: FlatTask[]): string[] => {
    const children = list.filter(t => t.parentId === id);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getDescendants(c.id, list)];
    });
    return ids;
  };

  const navigateIn = (taskId: string) => {
    setDirection(1);
    setNavigationStack([...navigationStack, taskId]);
  };

  const navigateBack = () => {
    setDirection(-1);
    setNavigationStack(navigationStack.slice(0, -1));
  };

  const currentItems = useMemo(() => {
    let items: TreeTask[] = [];
    if (showAllTasks) {
      items = flatTasks.map(t => ({ ...t, subtasks: [] })) as TreeTask[];
      items.sort((a, b) => {
        const valA = a.dueDate ? a.dueDate.trim() : '';
        const valB = b.dueDate ? b.dueDate.trim() : '';
        
        if (valA && !valB) return -1;
        if (!valA && valB) return 1;
        if (!valA && !valB) {
          const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        }
        return valA.localeCompare(valB);
      });
    } else {
      items = getCurrentCollection();
    }
    
    if (searchQuery) {
      const q = searchQuery.toLocaleLowerCase('tr-TR');
      items = items.filter(task => task.title.toLocaleLowerCase('tr-TR').includes(q));
    }

    if (filterMode !== 'all') {
      items = items.filter(task => {
        if (filterMode === 'completed') return task.completed;
        if (filterMode === 'uncompleted') return !task.completed;
        return task.priority === filterMode;
      });
    }

    return items;
  }, [navigationStack, flatTasks, taskTree, searchQuery, showAllTasks, filterMode]);

  const [orderedItems, setOrderedItems] = useState<TreeTask[]>([]);

  useEffect(() => {
    setOrderedItems(currentItems);
  }, [currentItems]);

  if (!user) {
    return (
      <div className="bg-brand-bg text-brand-fg min-h-screen flex flex-col items-center justify-center p-8 text-center font-sans">
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-8xl font-black tracking-tighter mb-16"
        >
          NOX
        </motion.h1>
        <p className="text-xs uppercase tracking-[0.5em] opacity-30 mb-24 max-w-xs">
          DÜNYANIN EN BASİT VE AKICI GÖREV SİSTEMİ
        </p>
        <button 
          onClick={async () => {
            triggerFeedback();
            try {
              await signInWithGoogle();
            } catch (error: any) {
              if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error("Login unexpected error:", error);
              }
            }
          }}
          className="flex items-center gap-6 text-2xl font-medium border-2 border-brand-fg px-12 py-6 hover:bg-brand-fg hover:text-brand-bg transition-all group active:scale-95"
        >
          <LogIn size={24} />
          GOOGLE İLE GİRİŞ YAP
        </button>
      </div>
    );
  }

  if (loading && flatTasks.length === 0) {
    return (
      <div className="bg-brand-bg text-brand-fg min-h-screen flex items-center justify-center">
        <motion.div 
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-xs uppercase tracking-[1em]"
        >
          YÜKLENİYOR
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-brand-bg text-brand-fg min-h-screen flex flex-col font-sans overflow-hidden">
      {/* Header Section */}
      <header className="p-4 md:p-16 pb-4 md:pb-6 border-b border-brand-fg/20 flex justify-between items-end sticky top-0 bg-brand-bg z-20">
        <div className="flex flex-col gap-1 md:gap-2 min-w-0 flex-1 @container">
          <AnimatePresence mode="wait">
            {navigationStack.length > 0 && (
              <motion.button
                key="back"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 0.5, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2 text-[10px] md:text-xs uppercase tracking-[0.3em] hover:opacity-100 transition-opacity w-fit"
                onClick={() => {
                  triggerFeedback();
                  navigateBack();
                }}
              >
                <ChevronLeft size={14} /> GERİ
              </motion.button>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2 md:gap-6 min-w-0">
            <motion.h1 
              key={getActiveTitle()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-[clamp(1rem,12cqw,4.5rem)] sm:text-[clamp(2rem,8cqw,5rem)] md:text-7xl font-bold tracking-tighter truncate leading-tight transition-opacity duration-500 min-w-0 ${currentTask?.completed ? 'opacity-30' : 'opacity-100'}`}
            >
              {getActiveTitle()}
            </motion.h1>
            {currentTask && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={() => {
                  triggerFeedback();
                  toggleTask(currentTask.id, currentTask.completed);
                }}
                className={`flex shrink-0 items-center justify-center transition-all ${currentTask.completed ? 'text-brand-fg' : 'text-brand-fg/10'}`}
              >
              <AnimatePresence mode="wait" initial={false}>
                {currentTask.completed ? (
                  <motion.svg 
                    key="header-complete"
                    initial={{ pathLength: 0, scale: 0.5, opacity: 0, rotate: -45 }}
                    animate={{ pathLength: 1, scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.4, type: "spring", bounce: 0.5 }}
                    className="w-8 h-8 md:w-12 md:h-12" 
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                  >
                    <motion.polyline 
                       initial={{ pathLength: 0 }}
                       animate={{ pathLength: 1 }}
                       transition={{ duration: 0.4 }}
                       points="20 6 9 17 4 12" 
                    />
                  </motion.svg>
                ) : (
                  <motion.span 
                    key="header-incomplete"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.2 } }}
                    className="text-2xl md:text-5xl"
                  >
                    ✓
                  </motion.span>
                )}
              </AnimatePresence>
              </motion.button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-8 ml-2 md:ml-4 shrink-0">
          <button 
            onClick={() => {
              triggerFeedback();
              toggleSound();
            }}
            className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center hover:opacity-50 transition-all group"
            title={isSoundEnabled ? "Sesi Kapat" : "Sesi Aç"}
          >
            {isSoundEnabled ? <Volume2 className="w-5 h-5 md:w-8 md:h-8 group-hover:scale-110 transition-transform" /> : <VolumeX className="w-5 h-5 md:w-8 md:h-8 opacity-50 group-hover:scale-110 transition-transform" />}
          </button>
          <button 
            onClick={() => {
              triggerFeedback();
              setIsSearching(!isSearching);
              if (isSearching) setSearchQuery('');
            }}
            className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center hover:opacity-50 transition-all group"
            title="Ara"
          >
            <Search className="w-5 h-5 md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={() => {
              triggerFeedback();
              setIsQuickAddOpen(true);
            }}
            className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center hover:opacity-50 transition-all group text-amber-400"
            title="Hızlı Görev Ekle"
          >
            <Zap className="w-5 h-5 md:w-8 md:h-8 group-hover:scale-110 group-hover:rotate-12 transition-all fill-amber-400/10" />
          </button>
          <button 
            onClick={() => {
              triggerFeedback();
              setIsAdding(true);
            }}
            className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center hover:opacity-50 transition-all group"
          >
            <Plus className="w-6 h-6 md:w-12 md:h-12 group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={() => {
              triggerFeedback();
              setIsStatsOpen(true);
            }}
            className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center hover:opacity-50 transition-all group"
            title="Analiz"
          >
            <BarChart2 className="w-5 h-5 md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={() => {
              triggerFeedback();
              setIsSettingsOpen(true);
            }}
            className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center hover:opacity-50 transition-all group"
            title="Ayarlar"
          >
            <Settings className="w-5 h-5 md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
          </button>
          <button 
            onClick={() => {
              triggerFeedback();
              localStorage.removeItem('google_calendar_token');
              signOut(auth);
            }}
            className="opacity-20 hover:opacity-100 transition-opacity p-2"
            title="Çıkış Yap"
          >
            <LogOut className="w-4 h-4 md:w-6 md:h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-16 pt-6 md:pt-8 overflow-y-auto">
        <div className="flex flex-col gap-8 md:gap-12 max-w-6xl mx-auto">
          
          <AnimatePresence>
            {isSearching && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="relative">
                  <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 md:w-8 md:h-8 text-brand-fg/30" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="ARA..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-b border-brand-fg/20 pb-4 pl-10 md:pl-14 text-2xl md:text-4xl font-bold tracking-tighter outline-none placeholder:opacity-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        triggerFeedback();
                        setSearchQuery('');
                      }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 p-2 hover:opacity-50 transition-opacity"
                    >
                      <X className="w-6 h-6 md:w-8 md:h-8 text-brand-fg/50" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* View Toggle Tabs */}
          <div className="flex justify-between items-center border-b border-brand-fg/10 pb-4">
            <div className="flex gap-6">
              <button 
                onClick={() => {
                  triggerFeedback();
                  setIsCalendarView(false);
                }} 
                className={`pb-2 px-1 text-xs uppercase tracking-widest border-b-2 transition-all ${!isCalendarView ? 'border-brand-fg font-bold opacity-100' : 'border-transparent opacity-40 hover:opacity-75'}`}
              >
                LİSTE GÖRÜNÜMÜ
              </button>
              <button 
                onClick={() => {
                  triggerFeedback();
                  setIsCalendarView(true);
                }} 
                className={`pb-2 px-1 text-xs uppercase tracking-widest border-b-2 transition-all ${isCalendarView ? 'border-brand-fg font-bold opacity-100' : 'border-transparent opacity-40 hover:opacity-75'}`}
              >
                TAKVİM GÖRÜNÜMÜ
              </button>
            </div>

            {!isCalendarView && (
              <button
                onClick={() => {
                  triggerFeedback();
                  setShowAllTasks(!showAllTasks);
                }}
                className={`text-[10px] uppercase tracking-wider font-mono transition-all rounded-full px-3 py-1 flex items-center gap-1.5 border ${
                  showAllTasks 
                    ? 'border-brand-fg bg-brand-fg/10 font-bold opacity-100 text-brand-fg' 
                    : 'border-brand-fg/10 opacity-40 hover:opacity-80 text-brand-fg bg-transparent'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${showAllTasks ? 'bg-amber-500 animate-pulse' : 'bg-brand-fg/30'}`} />
                TÜMÜNÜ GÖSTER
              </button>
            )}
          </div>

          {/* Task Filters (Only in List View) */}
          {!isCalendarView && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="flex gap-2 overflow-x-auto snap-x py-2 -mt-4 mb-2 max-w-full" style={{ scrollbarWidth: 'none' }}
            >
              {(['all', 'high', 'medium', 'low', 'completed', 'uncompleted'] as const).map(filterItem => (
                <button
                  key={filterItem}
                  onClick={() => {
                    triggerFeedback();
                    setFilterMode(filterItem);
                  }}
                  className={`snap-center flex-shrink-0 text-[10px] md:text-xs font-mono uppercase tracking-widest px-4 py-2 md:px-5 md:py-2.5 rounded-full border transition-all ${
                    filterMode === filterItem
                      ? (
                        filterItem === 'high' ? 'bg-red-500/10 border-red-500/50 text-red-500 font-bold shadow-sm' :
                        filterItem === 'medium' ? 'bg-orange-500/10 border-orange-500/50 text-orange-500 font-bold shadow-sm' :
                        filterItem === 'low' ? 'bg-blue-500/10 border-blue-500/50 text-blue-500 font-bold shadow-sm' :
                        filterItem === 'completed' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 font-bold shadow-sm' :
                        'bg-brand-fg border-brand-fg text-brand-bg font-bold shadow-sm'
                      )
                      : 'border-brand-fg/15 text-brand-fg/60 hover:bg-brand-fg/5 hover:text-brand-fg hover:border-brand-fg/30'
                  }`}
                >
                  {filterItem === 'all' ? 'TÜMÜ' :
                   filterItem === 'high' ? '⚡ YÜKSEK' :
                   filterItem === 'medium' ? 'ORTA' :
                   filterItem === 'low' ? 'DÜŞÜK' :
                   filterItem === 'completed' ? '✓ TAMAMLANANLAR' :
                   '○ BEKLEYENLER'}
                </button>
              ))}
            </motion.div>
          )}

          {isCalendarView ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-6"
            >
              {/* Calendar Month Selector */}
              <div className="flex justify-between items-center bg-brand-fg/5 p-4 rounded-3xl border border-brand-fg/5">
                <button 
                  onClick={() => {
                    triggerFeedback();
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear(y => y - 1);
                    } else {
                      setCalendarMonth(m => m - 1);
                    }
                  }}
                  className="p-3 opacity-60 hover:opacity-100 transition-opacity bg-brand-fg/5 rounded-full"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg md:text-xl font-bold tracking-tight uppercase font-mono">
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </h2>
                <button 
                  onClick={() => {
                    triggerFeedback();
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear(y => y + 1);
                    } else {
                      setCalendarMonth(m => m + 1);
                    }
                  }}
                  className="p-3 opacity-60 hover:opacity-100 transition-opacity bg-brand-fg/5 rounded-full rotate-180"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>

              {/* Day Titles */}
              <div className="grid grid-cols-7 gap-1 md:gap-3 text-center text-xs opacity-40 font-bold uppercase tracking-wider font-mono">
                <div>Pzt</div>
                <div>Sal</div>
                <div>Çar</div>
                <div>Per</div>
                <div>Cum</div>
                <div>Cmt</div>
                <div>Paz</div>
              </div>

              {/* Calendar Days Matrix */}
              <div className="grid grid-cols-7 gap-1 md:gap-3">
                {(() => {
                  const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                  let firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
                  firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Mon-Sun index

                  const cells = [];
                  const prevMonthTotalDays = new Date(calendarYear, calendarMonth, 0).getDate();
                  for (let i = firstDayIndex - 1; i >= 0; i--) {
                    cells.push({
                      day: prevMonthTotalDays - i,
                      isCurrentMonth: false,
                      month: calendarMonth === 0 ? 11 : calendarMonth - 1,
                      year: calendarMonth === 0 ? calendarYear - 1 : calendarYear,
                    });
                  }

                  for (let i = 1; i <= totalDays; i++) {
                    cells.push({
                      day: i,
                      isCurrentMonth: true,
                      month: calendarMonth,
                      year: calendarYear,
                    });
                  }

                  const remainingCells = 42 - cells.length;
                  for (let i = 1; i <= remainingCells; i++) {
                    cells.push({
                      day: i,
                      isCurrentMonth: false,
                      month: calendarMonth === 11 ? 0 : calendarMonth + 1,
                      year: calendarMonth === 11 ? calendarYear + 1 : calendarYear,
                    });
                  }

                  return cells.map((cell, idx) => {
                    const monthStr = String(cell.month + 1).padStart(2, '0');
                    const dayStr = String(cell.day).padStart(2, '0');
                    const formattedDate = `${cell.year}-${monthStr}-${dayStr}`;
                    
                    const dayTasks = flatTasks.filter(t => t.dueDate === formattedDate);
                    const isToday = formattedDate === todayDateStr;
                    const hasTasks = dayTasks.length > 0;
                    const completedCount = dayTasks.filter(t => t.completed).length;

                    return (
                      <motion.div
                        key={`${formattedDate}-${idx}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onPointerDown={() => handleCalendarDayPointerDown(formattedDate, dayTasks)}
                        onPointerUp={clearCalendarDayLongPress}
                        onPointerLeave={clearCalendarDayLongPress}
                        onPointerCancel={clearCalendarDayLongPress}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`relative aspect-square rounded-2xl flex flex-col justify-between p-2 md:p-3 border select-none cursor-pointer transition-all ${
                          cell.isCurrentMonth ? 'opacity-100' : 'opacity-25'
                        } ${
                          isToday 
                            ? 'bg-brand-fg/[0.08] border-brand-fg/40' 
                            : 'bg-brand-fg/5 border-brand-fg/5 hover:border-brand-fg/20'
                        }`}
                        onClick={() => {
                          if (hasTasks) {
                            setLongPressedCalendarDay({ dayStr: formattedDate, tasks: dayTasks });
                          } else {
                            triggerFeedback();
                            setDueDateValue(formattedDate);
                            setIsAdding(true);
                          }
                        }}
                      >
                        <span className={`text-xs md:text-sm font-semibold font-mono ${isToday ? 'text-amber-500 font-bold underline' : ''}`}>
                          {cell.day}
                        </span>

                        {hasTasks && (
                          <div className="flex flex-col gap-1 w-full mt-auto">
                            <div className="hidden md:flex flex-col gap-0.5">
                              <span className="text-[8px] font-bold text-brand-fg/50 tracking-tighter truncate leading-none uppercase">
                                {dayTasks.length} GÖREV
                              </span>
                              <div className="h-1 bg-brand-fg/10 rounded-full w-full overflow-hidden">
                                <div 
                                  className="h-full bg-brand-fg" 
                                  style={{ width: `${(completedCount / dayTasks.length) * 100}%` }}
                                />
                              </div>
                            </div>
                            
                            <div className="flex md:hidden gap-1 justify-center mt-1">
                              {dayTasks.map((t) => (
                                <div 
                                  key={t.id} 
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    t.completed 
                                      ? 'bg-brand-fg/20' 
                                      : t.priority === 'high' ? 'bg-red-500' 
                                      : t.priority === 'medium' ? 'bg-orange-500' 
                                      : 'bg-blue-500'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  });
                })()}
              </div>

              <p className="text-center text-[10px] md:text-xs opacity-40 font-mono tracking-widest mt-2 uppercase">
                💡 Mobil Cihazlarda Görevleri Görmek İçin Güne <span className="underline font-bold">Basılı Tutun</span>
              </p>
            </motion.div>
          ) : (
            <section className="flex flex-col">
              <motion.div layout className="space-y-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {orderedItems.map((task, index) => {
                    const isDueToday = task.dueDate === todayDateStr && !task.completed;
                    return (
                      <motion.div
                        key={task.id}
                        layout="position"
                        custom={direction}
                        initial={{ opacity: 0, x: 20 * direction, filter: 'blur(5px)' }}
                        animate={{ 
                          opacity: 1, 
                          x: 0, 
                          filter: 'blur(0px)',
                          transition: { delay: index * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] } 
                        }}
                        exit={{ 
                          opacity: 0, 
                          scale: 0.95, 
                          filter: 'blur(5px)',
                          transition: { duration: 0.3, ease: 'easeOut' } 
                        }}
                        className="relative overflow-hidden rounded-2xl group/swipe select-none"
                      >
                        {/* Foreground Draggable Card */}
                        <motion.div
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={{ left: 0.6, right: 0.6 }}
                          dragTransition={{ bounceStiffness: 600, bounceDamping: 25 }}
                          onDragStart={() => {
                            isDraggingRef.current = true;
                          }}
                          onDrag={(event, info) => {
                            const el = (event.target as HTMLElement).closest('.draggable-card') as HTMLElement;
                            if (el) {
                               const threshold = 100;
                               const currentlyPassed = Math.abs(info.offset.x) > threshold;
                               const previouslyPassed = el.dataset.passed === 'true';
                               
                               if (currentlyPassed && !previouslyPassed) {
                                  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 30, 50]);
                                  el.dataset.passed = 'true';
                               } else if (!currentlyPassed && previouslyPassed) {
                                  el.dataset.passed = 'false';
                               }

                               if (info.offset.x > 0) {
                                  // Swipe Right -> Complete
                                  const opacity = Math.min(info.offset.x / threshold, 1) * 0.5;
                                  el.style.boxShadow = currentlyPassed ? `inset 0 0 40px rgba(16, 185, 129, 0.4), 0 0 20px rgba(16, 185, 129, 0.6)` : `inset 0 0 20px rgba(16, 185, 129, ${opacity})`;
                                  el.style.borderColor = `rgba(16, 185, 129, ${currentlyPassed ? 0.8 : opacity * 0.5})`;
                               } else if (info.offset.x < 0) {
                                  // Swipe Left -> Delete
                                  const opacity = Math.min(-info.offset.x / threshold, 1) * 0.5;
                                  el.style.boxShadow = currentlyPassed ? `inset 0 0 40px rgba(239, 68, 68, 0.4), 0 0 20px rgba(239, 68, 68, 0.6)` : `inset 0 0 20px rgba(239, 68, 68, ${opacity})`;
                                  el.style.borderColor = `rgba(239, 68, 68, ${currentlyPassed ? 0.8 : opacity * 0.5})`;
                               }
                            }
                          }}
                          onDragEnd={(event, info) => {
                            setTimeout(() => { isDraggingRef.current = false; }, 500);
                            const el = (event.target as HTMLElement).closest('.draggable-card') as HTMLElement;
                            if (el) {
                               el.style.boxShadow = '';
                               el.style.borderColor = '';
                               el.dataset.passed = 'false';
                            }
                            const threshold = 100;
                            if (info.offset.x > threshold) {
                              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
                              toggleTask(task.id, task.completed);
                            } else if (info.offset.x < -threshold) {
                              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
                              if (window.confirm('Bu görevi silmek istediğinize emin misiniz?')) {
                                const dummyEvent = { stopPropagation: () => {} } as React.MouseEvent;
                                deleteTask(task.id, dummyEvent);
                              }
                            }
                          }}
                          onPointerDown={() => handlePointerDown(task)}
                          onPointerUp={clearLongPress}
                          onPointerLeave={clearLongPress}
                          onPointerCancel={clearLongPress}
                          onContextMenu={(e) => {
                            e.preventDefault();
                          }}
                          onClickCapture={(e) => {
                            e.preventDefault();
                            if (isDraggingRef.current) return;
                            handleTaskClick(task);
                          }}
                          className={`draggable-card flex justify-between items-center group cursor-grab active:cursor-grabbing border pb-3 last:border-b select-none z-10 px-4 py-3 rounded-2xl transition-all duration-300 relative bg-brand-bg ${
                            isDueToday 
                              ? 'bg-amber-500/[0.04] border-amber-500/25 shadow-[0_4px_20px_rgba(245,158,11,0.08)] pl-6' 
                              : 'bg-brand-bg border-transparent border-b-brand-fg/5 hover:bg-brand-fg/[0.02]'
                          }`}
                        >
                          {isDueToday && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 md:w-1.5 bg-gradient-to-b from-amber-400 to-amber-600 rounded-r-xl" />
                          )}
                          <div className="flex-1 flex flex-col gap-0.5 min-w-0 origin-left">
                            <motion.span 
                              layout="position"
                              animate={{
                                opacity: task.completed ? 0.3 : 0.8,
                                scale: task.completed ? 0.85 : 1
                              }}
                              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                              style={{ transformOrigin: 'left center' }}
                              className={`text-xl md:text-2xl font-light tracking-tight break-words whitespace-pre-wrap ${task.completed ? 'line-through' : ''}`}
                            >
                              {task.title}
                            </motion.span>
                            {task.subtasks.length > 0 && (
                              <motion.div layout="position" className="flex flex-col gap-2 mt-1 w-full max-w-[10rem]">
                                <span 
                                  className="text-[9px] uppercase tracking-[0.2em] opacity-40"
                                >
                                  {task.subtasks.filter(s => s.completed).length} / {task.subtasks.length} TAMAMLANDI
                                </span>
                                <div className="h-[2px] w-full bg-brand-fg/10 rounded-full overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-brand-fg/70"
                                    initial={false}
                                    animate={{ width: `${(task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100}%` }}
                                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                  />
                                </div>
                              </motion.div>
                            )}
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              {task.priority && (
                                <motion.span
                                  layout="position"
                                  className={`text-[9px] md:text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-sm border ${
                                    task.priority === 'high' ? 'border-red-500/50 text-red-400 bg-red-500/10' :
                                    task.priority === 'medium' ? 'border-orange-500/50 text-orange-400 bg-orange-500/10' :
                                    'border-blue-500/50 text-blue-400 bg-blue-500/10'
                                  } ${task.completed ? 'opacity-30' : ''}`}
                                >
                                   {task.priority === 'high' ? 'YÜKSEK' : task.priority === 'medium' ? 'ORTA' : 'DÜŞÜK'}
                                </motion.span>
                              )}
                              {task.dueDate && (
                                <motion.span 
                                  layout="position"
                                  className={`text-[10px] md:text-xs font-mono uppercase opacity-50 ${task.completed ? 'line-through opacity-20' : ''} ${isDueToday ? 'text-amber-500 font-bold opacity-100' : ''}`}
                                >
                                  BİTİŞ: {task.dueDate} {isDueToday && '• BUGÜN ⚡'}
                                </motion.span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 md:gap-12 pointer-events-auto">
                            <button
                              onClickCapture={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (isDraggingRef.current) return;
                                if (window.confirm('Bu görevi silmek istediğinize emin misiniz?')) {
                                  triggerFeedback();
                                  deleteTask(task.id, e);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-30 hover:opacity-100 text-3xl transition-opacity px-2"
                            >
                              ×
                            </button>

                            <button
                              onClickCapture={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (isDraggingRef.current) return;
                                triggerFeedback();
                                toggleTask(task.id, task.completed);
                              }}
                              className={`w-12 h-12 flex items-center justify-center transition-colors duration-500 rounded-full ${task.completed ? 'bg-brand-fg/10' : 'hover:bg-brand-fg/5'}`}
                            >
                            <AnimatePresence mode="wait" initial={false}>
                              {task.completed ? (
                                <motion.svg 
                                  key={`check-${task.id}`}
                                  initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
                                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                  exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.2 } }}
                                  transition={{ duration: 0.4, type: "spring", bounce: 0.5 }}
                                  className="text-brand-fg w-5 h-5 md:w-6 md:h-6" 
                                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                                >
                                  <motion.polyline 
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.3 }}
                                    points="20 6 9 17 4 12" 
                                  />
                                </motion.svg>
                              ) : (
                                <motion.div 
                                  key={`circle-${task.id}`}
                                  initial={{ scale: 0.5, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.2 } }}
                                  className="w-4 h-4 border border-brand-fg/40 rounded-full group-hover:border-brand-fg transition-colors"
                                ></motion.div>
                              )}
                            </AnimatePresence>
                            </button>
                          </div>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </section>
          )}
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="p-16 pt-8 border-t border-brand-fg/10 flex justify-between items-center text-xs tracking-widest opacity-30 uppercase">
        <div>{stats.completed} TAMAMLANDI / {stats.total} TOPLAM</div>
        <div>Minimalist Nox v2.0-cloud</div>
      </footer>

      {/* Quick Task Add Overlay */}
      <AnimatePresence>
        {isQuickAddOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-brand-bg/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 cursor-default"
            onClick={() => setIsQuickAddOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-brand-bg border border-brand-fg/10 p-6 md:p-8 w-full max-w-lg rounded-[2rem] shadow-2xl flex flex-col gap-6 relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Close Button */}
              <div className="absolute top-6 right-6">
                <button 
                  onClick={() => setIsQuickAddOpen(false)} 
                  className="p-2 opacity-55 hover:opacity-100 rounded-full hover:bg-brand-fg/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Title Header */}
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-amber-400 fill-amber-400/20" />
                <h3 className="text-xl md:text-2xl font-bold tracking-tight">Hızlı Görev Ekle</h3>
              </div>

              {/* Task Title Input */}
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.2em] opacity-40">GÖREV BAŞLIĞI</span>
                <input
                  type="text"
                  autoFocus
                  placeholder="Hızlıca bir şeyler yazın..."
                  className="bg-brand-fg/5 outline-none border border-brand-fg/15 rounded-2xl px-4 py-3 text-lg font-light tracking-tight w-full hover:border-brand-fg/30 focus:border-brand-fg/50 transition-colors"
                  value={quickInputValue}
                  onChange={(e) => setQuickInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addQuickTask();
                    }
                  }}
                />
              </div>

              {/* Task Placement Toggle (Root vs. Nest) - Only visible if we are nested! */}
              {navigationStack.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] opacity-40 font-mono">KONUM</span>
                  <div className="flex gap-2 p-1 bg-brand-fg/5 rounded-2xl border border-brand-fg/5">
                    <button
                      type="button"
                      onClick={() => {
                        triggerFeedback();
                        setQuickAddTargetRoot(true);
                      }}
                      className={`flex-1 py-1.5 text-xs uppercase tracking-wider font-semibold rounded-xl transition-all ${
                        quickAddTargetRoot 
                          ? 'bg-brand-fg text-brand-bg shadow-sm' 
                          : 'text-brand-fg/60 hover:text-brand-fg'
                      }`}
                    >
                      Ana Ekran (Root)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerFeedback();
                        setQuickAddTargetRoot(false);
                      }}
                      className={`flex-1 py-1.5 text-xs uppercase tracking-wider font-semibold rounded-xl transition-all ${
                        !quickAddTargetRoot 
                          ? 'bg-brand-fg text-brand-bg shadow-sm' 
                          : 'text-brand-fg/60 hover:text-brand-fg'
                      }`}
                    >
                      Mevcut Bölüm
                    </button>
                  </div>
                </div>
              )}

              {/* Due Date Option */}
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.2em] opacity-40 font-mono font-semibold">BİTİŞ TARİHİ</span>
                <input 
                  type="date"
                  value={quickDueDateValue}
                  onChange={(e) => setQuickDueDateValue(e.target.value)}
                  className="bg-brand-fg/5 text-brand-fg font-mono outline-none cursor-pointer border border-brand-fg/15 rounded-2xl px-4 py-3 text-sm [color-scheme:dark] w-full"
                />
              </div>

              {/* Priority Option */}
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.2em] opacity-40 font-mono font-semibold">ÖNCELİK</span>
                <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        triggerFeedback();
                        setQuickPriorityValue(p === quickPriorityValue ? null : p);
                      }}
                      className={`text-xs uppercase tracking-widest px-4 py-2 rounded-xl border transition-all whitespace-nowrap flex-1 text-center ${quickPriorityValue === p ? (
                        p === 'high' ? 'bg-red-500/20 border-red-500 text-red-500 font-semibold' :
                        p === 'medium' ? 'bg-orange-500/20 border-orange-500 text-orange-500 font-semibold' :
                        'bg-blue-500/20 border-blue-500 text-blue-500 font-semibold'
                      ) : 'border-brand-fg/10 text-brand-fg/50 hover:border-brand-fg/30 bg-brand-fg/5'}`}
                    >
                      {p === 'high' ? 'YÜKSEK' : p === 'medium' ? 'ORTA' : 'DÜŞÜK'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Submit Button */}
              <button 
                onClick={() => {
                  triggerFeedback();
                  addQuickTask();
                }}
                disabled={!quickInputValue.trim()}
                className="mt-2 w-full flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-bold py-4 rounded-2xl bg-brand-fg text-brand-bg hover:opacity-90 active:scale-98 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <Plus size={14} strokeWidth={3} />
                GÖREVİ EKLE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Task Overlay */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-brand-bg/95 z-50 flex flex-col p-6 md:p-16"
          >
            <div className="flex-between items-end mb-12 md:mb-24 border-b border-brand-fg pb-4 md:pb-8 flex justify-between gap-4">
              <h1 className="text-4xl md:text-7xl font-bold tracking-tighter shrink">
                {navigationStack.length === 0 ? 'YENİ GÖREV' : 'YENİ ALT GÖREV'}
              </h1>
              <button 
                onClick={() => {
                  triggerFeedback();
                  setIsAdding(false);
                }}
                className="text-sm md:text-xl opacity-50 hover:opacity-100 uppercase tracking-widest md:mb-4 bg-brand-fg/10 px-4 py-2 rounded-full shrink-0"
              >
                Kapat
              </button>
            </div>
            
            <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
              <textarea
                ref={inputRef}
                autoFocus
                placeholder="BURAYA YAZIN..."
                rows={4}
                className={`bg-transparent font-bold tracking-tighter outline-none placeholder:opacity-5 border-none w-full transition-all duration-300 resize-none ${
                  navigationStack.length === 0 
                  ? 'text-3xl md:text-6xl/tight' 
                  : 'text-2xl md:text-4xl/tight'
                }`}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    addTask();
                  }
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
              
              <div className="mt-8 flex flex-col md:flex-row md:items-center gap-4 border-b border-brand-fg/20 pb-4">
                <span className="text-xs uppercase tracking-[0.2em] opacity-40">BİTİŞ TARİHİ</span>
                <input 
                  type="date"
                  value={dueDateValue}
                  onChange={(e) => setDueDateValue(e.target.value)}
                  className="bg-transparent text-brand-fg font-mono outline-none cursor-pointer placeholder:opacity-20 flex-1 [color-scheme:dark]"
                />
              </div>

              <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4 border-b border-brand-fg/20 pb-4">
                <span className="text-xs uppercase tracking-[0.2em] opacity-40">ÖNCELİK</span>
                <div className="flex gap-2 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        triggerFeedback();
                        setPriorityValue(p === priorityValue ? null : p);
                      }}
                      className={`text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-all whitespace-nowrap ${priorityValue === p ? (
                        p === 'high' ? 'bg-red-500/20 border-red-500 text-red-500' :
                        p === 'medium' ? 'bg-orange-500/20 border-orange-500 text-orange-500' :
                        'bg-blue-500/20 border-blue-500 text-blue-500'
                      ) : 'border-brand-fg/20 text-brand-fg/50 hover:border-brand-fg/50'}`}
                    >
                      {p === 'high' ? 'YÜKSEK' : p === 'medium' ? 'ORTA' : 'DÜŞÜK'}
                    </button>
                  ))}
                </div>
              </div>

              <motion.button 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  triggerFeedback();
                  addTask();
                }}
                className="mt-24 self-start flex items-center gap-6 text-2xl font-medium group"
              >
                <Plus size={32} strokeWidth={3} />
                GÖREV OLUŞTUR
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {longPressedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-brand-bg/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={() => setLongPressedTask(null)}
          >
            <motion.div
              initial={{ scale: 0.7, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 400, mass: 0.8 }}
              className="bg-brand-bg border border-brand-fg/10 p-6 md:p-8 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col gap-4 relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4">
                <button onClick={() => setLongPressedTask(null)} className="p-2 opacity-50 hover:opacity-100 rounded-full bg-brand-fg/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2 pr-8">{longPressedTask.title}</h3>
              <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'none' }}>
                {longPressedTask.subtasks.length === 0 ? (
                  <p className="text-brand-fg/40 text-sm">Alt görev bulunmuyor.</p>
                ) : (
                  longPressedTask.subtasks.map(subtask => (
                    <div key={subtask.id} className="flex items-center gap-3 p-3 bg-brand-fg/5 rounded-2xl">
                      <div className={`w-4 h-4 rounded-full border border-brand-fg/20 flex-shrink-0 ${subtask.completed ? 'bg-brand-fg' : ''}`} />
                      <span className={`text-sm md:text-base opacity-80 ${subtask.completed ? 'line-through opacity-40' : ''}`}>
                        {subtask.title}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-brand-fg/10 pt-4">
                <span className="text-xs uppercase tracking-[0.2em] opacity-40">ÖNCELİK DEĞİŞTİR</span>
                <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        triggerFeedback();
                        const newPriority = p === longPressedTask.priority ? null : p;
                        updateTaskPriority(longPressedTask.id, newPriority);
                      }}
                      className={`text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-all whitespace-nowrap ${longPressedTask.priority === p ? (
                        p === 'high' ? 'bg-red-500/20 border-red-500 text-red-500' :
                        p === 'medium' ? 'bg-orange-500/20 border-orange-500 text-orange-500' :
                        'bg-blue-500/20 border-blue-500 text-blue-500'
                      ) : 'border-brand-fg/20 text-brand-fg/40 hover:border-brand-fg/60'}`}
                    >
                      {p === 'high' ? 'YÜKSEK' : p === 'medium' ? 'ORTA' : 'DÜŞÜK'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-3 border-t border-brand-fg/10 pt-4">
                <span className="text-xs uppercase tracking-[0.2em] opacity-40">BİTİŞ TARİHİ DEĞİŞTİR</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="date"
                    value={longPressedTask.dueDate || ''}
                    onChange={(e) => {
                      triggerFeedback();
                      updateTaskDueDate(longPressedTask.id, e.target.value);
                    }}
                    className="bg-transparent text-brand-fg font-mono outline-none cursor-pointer flex-1 [color-scheme:dark] border border-brand-fg/10 rounded-xl px-3 py-2 text-sm"
                  />
                  {longPressedTask.dueDate && (
                    <button
                      onClick={() => {
                        triggerFeedback();
                        updateTaskDueDate(longPressedTask.id, '');
                      }}
                      className="text-xs uppercase tracking-widest px-3 py-2 rounded-xl border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-colors"
                    >
                      X
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-3 border-t border-brand-fg/10 pt-4">
                <span className="text-xs uppercase tracking-[0.2em] opacity-40">PAYLAŞ</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyTaskText(longPressedTask)}
                    className="flex-1 flex items-center justify-center gap-2 text-xs uppercase tracking-widest px-3 py-2.5 rounded-xl border border-brand-fg/10 hover:border-brand-fg/30 transition-all font-mono text-brand-fg/70 hover:text-brand-fg"
                    title="Metni Kopyala"
                  >
                    <Copy className="w-3.5 h-3.5" /> Kopyala
                  </button>
                  <button
                    onClick={() => handleNativeShareTask(longPressedTask)}
                    className="flex-1 flex items-center justify-center gap-2 text-xs uppercase tracking-widest px-3 py-2.5 rounded-xl border border-brand-fg/10 hover:border-brand-fg/30 transition-all font-mono text-brand-fg/70 hover:text-brand-fg"
                    title="Sistem Paylaşımı"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Paylaş
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-brand-bg/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={() => setIsSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.7, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 400, mass: 0.8 }}
              className="bg-brand-bg border border-brand-fg/10 p-6 md:p-8 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col gap-6 relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4">
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 opacity-50 hover:opacity-100 rounded-full bg-brand-fg/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2 pr-8">AYARLAR</h3>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium opacity-80">Arka Plan Rengi</span>
                  <input 
                    type="color" 
                    value={bgColor}
                    onChange={e => {
                      setBgColor(e.target.value);
                      localStorage.setItem('nox_bgColor', e.target.value);
                    }}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium opacity-80">Tema Rengi</span>
                  <input 
                    type="color" 
                    value={themeColor}
                    onChange={e => {
                      setThemeColor(e.target.value);
                      localStorage.setItem('nox_themeColor', e.target.value);
                    }}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium opacity-80">Otomatik Gündüz/Gece</span>
                  <button 
                    onClick={() => {
                      const newVal = !autoLightMode;
                      setAutoLightMode(newVal);
                      localStorage.setItem('nox_autoLight', newVal.toString());
                    }}
                    className={`w-12 h-6 rounded-full relative transition-colors ${autoLightMode ? 'bg-green-500' : 'bg-brand-fg/20'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-brand-fg transition-all ${autoLightMode ? 'left-7 bg-white' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2 pt-4 border-t border-brand-fg/10">
                  <span className="text-sm font-medium opacity-80">Karanlık Mod (Sıfırla)</span>
                  <button
                    onClick={() => {
                      setBgColor('#000000');
                      setThemeColor('#ffffff');
                      setAutoLightMode(false);
                      localStorage.setItem('nox_bgColor', '#000000');
                      localStorage.setItem('nox_themeColor', '#ffffff');
                      localStorage.setItem('nox_autoLight', 'false');
                    }}
                    className="px-3 py-1.5 bg-brand-fg/10 hover:bg-brand-fg/20 rounded text-xs font-bold transition-colors"
                  >
                    SIFIRLA
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isStatsOpen && (
          <StatsOverlay
            isOpen={isStatsOpen}
            onClose={() => setIsStatsOpen(false)}
            flatTasks={flatTasks}
            themeColor={themeColor}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {longPressedCalendarDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-brand-bg/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setLongPressedCalendarDay(null)}
          >
            <motion.div
              initial={{ scale: 0.7, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 400, mass: 0.8 }}
              className="bg-brand-bg border border-brand-fg/10 p-6 md:p-8 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col gap-4 relative cursor-default"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => setLongPressedCalendarDay(null)} 
                  className="p-2 opacity-50 hover:opacity-100 rounded-full bg-brand-fg/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-lg md:text-xl font-bold tracking-tight mb-2 pr-8 uppercase flex flex-col gap-0.5">
                <span className="text-[10px] uppercase font-mono tracking-[0.2em] opacity-45">GÖREV LİSTESİ</span>
                <span>{new Date(longPressedCalendarDay.dayStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </h3>
              <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'none' }}>
                {longPressedCalendarDay.tasks.map(task => (
                  <div key={task.id} className="flex flex-col gap-2 p-3 bg-brand-fg/5 rounded-2xl border border-brand-fg/5 relative group">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            triggerFeedback();
                            toggleTask(task.id, task.completed);
                            // Also update inside longPressedCalendarDay state to render checklist check
                            setLongPressedCalendarDay(prev => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                tasks: prev.tasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t)
                              };
                            });
                          }}
                          className={`w-6 h-6 border flex-shrink-0 rounded-full transition-all flex items-center justify-center ${
                            task.completed ? 'bg-brand-fg border-brand-fg text-brand-bg' : 'border-brand-fg/30'
                          }`}
                        >
                          {task.completed && <Check className="w-4 h-4" strokeWidth={3} />}
                        </button>
                        <span className={`text-sm md:text-base font-medium transition-all ${task.completed ? 'line-through opacity-40' : 'opacity-90'}`}>
                          {task.title}
                        </span>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          triggerFeedback();
                          await deleteTask(task.id, e);
                          setLongPressedCalendarDay(prev => {
                            if (!prev) return null;
                            const remaining = prev.tasks.filter(t => t.id !== task.id);
                            if (remaining.length === 0) return null;
                            return { ...prev, tasks: remaining };
                          });
                        }}
                        className="opacity-20 hover:opacity-100 text-lg transition-opacity px-2 font-light"
                        title="Sil"
                      >
                        ×
                      </button>
                    </div>

                    {/* Subtasks inside calendar preview if any */}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="pl-9 flex flex-col gap-1 border-t border-brand-fg/5 pt-2">
                        {task.subtasks.map(sub => (
                          <div key={sub.id} className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${sub.completed ? 'bg-brand-fg' : 'border border-brand-fg/30'}`} />
                            <span className={`text-xs ${sub.completed ? 'line-through opacity-40' : 'opacity-70'}`}>
                              {sub.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Meta inside preview */}
                    <div className="flex gap-2 pl-9">
                      {task.priority && (
                        <span className={`text-[8px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-sm border ${
                          task.priority === 'high' ? 'border-red-500/30 text-red-400 bg-red-500/5' :
                          task.priority === 'medium' ? 'border-orange-500/30 text-orange-400 bg-orange-500/5' :
                          'border-blue-500/30 text-blue-400 bg-blue-500/5'
                        }`}>
                          {task.priority === 'high' ? 'YÜKSEK' : task.priority === 'medium' ? 'ORTA' : 'DÜŞÜK'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full border border-brand-fg/10 bg-brand-bg shadow-2xl flex items-center gap-3 backdrop-blur-md max-w-sm w-[90%]"
          >
            <div className={`w-2 h-2 rounded-full ${
              toastMessage.type === 'success' ? 'bg-emerald-500' :
              toastMessage.type === 'error' ? 'bg-rose-500' : 'bg-brand-fg/40'
            }`} />
            <p className="text-sm font-medium tracking-tight text-brand-fg truncate">
              {toastMessage.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

