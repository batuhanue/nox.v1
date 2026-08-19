import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  Node,
  Edge,
  NodeProps,
  NodeChange,
  EdgeChange,
  Connection,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Task } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Plus, ChevronLeft, LogOut, CheckCircle2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, collection, onSnapshot, query, serverTimestamp } from 'firebase/firestore';
import { triggerHaptic } from '../App';

// Custom Node Component to look like a TaskCard
const TaskNode = ({ data, id }: NodeProps<Node<{ task: Task, onTaskClick: (t: Task) => void }>>) => {
  const { task, onTaskClick } = data;
  
  if (!task) return null;

  const isCompleted = task.completed;

  return (
    <div 
      className={`rounded-[24px] p-4 shadow-xl border-2 transition-colors duration-300 w-[260px] cursor-grab active:cursor-grabbing ${isCompleted ? 'border-emerald-500 opacity-80' : 'border-transparent'}`}
      style={{ backgroundColor: task.color }}
      onDoubleClick={() => onTaskClick(task)}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        id="task-target"
        className={`w-4 h-4 !bg-white border-2 ${isCompleted ? '!border-emerald-500' : '!border-black/20'}`} 
      />
      
      <div className="flex flex-col gap-3 pointer-events-none">
        <h4 className={`text-lg font-semibold text-black/90 leading-[1.1] whitespace-pre-line tracking-tight ${isCompleted ? 'line-through text-emerald-900' : ''}`}>
          {task.title}
        </h4>
        
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {task.subtasks.map((st) => (
              <div key={st.id} className="relative flex items-center bg-black/5 rounded-lg p-2 gap-2 pointer-events-auto cursor-default">
                <Handle 
                  type="target" 
                  position={Position.Left} 
                  id={`st-target-${st.id}`}
                  style={{ top: '50%', left: -8, width: 12, height: 12 }}
                  className="!bg-white border-2 !border-black/20" 
                />
                <div className={`w-3 h-3 shrink-0 rounded-full border-2 flex items-center justify-center ${st.completed ? 'bg-black border-black text-white' : 'border-black/30'}`} />
                <span className={`text-[0.6875rem] font-semibold text-black/80 line-clamp-1 ${st.completed ? 'line-through opacity-50' : ''}`}>{st.title}</span>
                <Handle 
                  type="source" 
                  position={Position.Right} 
                  id={`st-source-${st.id}`}
                  style={{ top: '50%', right: -8, width: 12, height: 12 }}
                  className="!bg-white border-2 !border-black/20" 
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          {!task.isAllDay && (
            <span className="bg-black/20 text-black/80 text-[0.625rem] px-3 py-1 rounded-full font-bold">
              {task.startTime || '-'} - {task.endTime || '-'}
            </span>
          )}
          {task.isAllDay && (
             <span className="bg-black/20 text-black/80 text-[0.625rem] px-3 py-1 rounded-full font-bold">
               Tüm Gün
             </span>
          )}
          {isCompleted && (
            <span className="text-[0.625rem] font-bold text-emerald-700 uppercase tracking-widest ml-auto">
              Tamamlandı
            </span>
          )}
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        id="task-source"
        className={`w-4 h-4 !bg-white border-2 ${isCompleted ? '!border-emerald-500' : '!border-black/20'}`} 
      />
    </div>
  );
};

const nodeTypes = {
  taskNode: TaskNode,
};

interface Project {
  id: string;
  name: string;
  createdAt: any;
  nodes?: any[];
  edges?: any[];
}

function CanvasFlow({ tasks, projectId, projectName, onTaskClick, onAddRequest, onBack }: { tasks: Task[], projectId: string, projectName: string, onTaskClick: (t: Task) => void, onAddRequest: () => void, onBack: () => void }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  // Load canvas state for specific project
  useEffect(() => {
    const loadCanvas = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const docRef = doc(db, `users/${user.uid}/projects/${projectId}`);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.nodes) setNodes(data.nodes);
        if (data.edges) setEdges(data.edges);
      }
    };
    loadCanvas();
  }, [projectId]);

  // Save canvas state
  const saveCanvas = useCallback(async (n: Node[], e: Edge[]) => {
    const user = auth.currentUser;
    if (!user) return;
    const docRef = doc(db, `users/${user.uid}/projects/${projectId}`);
    // Only save the necessary parts of nodes to avoid circular JSON and large sizes
    const cleanNodes = n.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: { taskId: (node.data as any).taskId } // only store taskId
    }));
    await setDoc(docRef, { nodes: cleanNodes, edges: e }, { merge: true });
  }, [projectId]);

  // Sync node data with latest task data
  const syncedNodes = nodes.map(node => {
    const taskId = (node.data as any).taskId;
    // Look in tasks first, then in subtasks
    let task = tasks.find(t => t.id === taskId);
    let originalTask = task;
    if (!task) {
      for (const t of tasks) {
        if (t.subtasks) {
          const st = t.subtasks.find(s => s.id === taskId);
          if (st) {
            originalTask = t; // we'll use originalTask for click handler
            task = {
              id: st.id,
              title: st.title,
              completed: st.completed,
              date: t.date,
              startTime: '',
              endTime: '',
              duration: '',
              color: t.color,
              attendees: [],
              type: t.type
            } as Task;
            break;
          }
        }
      }
    }
    
    return {
      ...node,
      data: { ...node.data, task, onTaskClick: (_t: any) => onTaskClick(originalTask || task!) }
    };
  });

  // Check if project is completed (all tasks in canvas are completed and there is at least one task)
  const isProjectCompleted = syncedNodes.length > 0 && syncedNodes.every(n => (n.data as any).task?.completed);

  // Calculate flow completion (animated edges turning green)
  const processedEdges = edges.map(edge => {
    const sourceNode = syncedNodes.find(n => n.id === edge.source);
    const targetNode = syncedNodes.find(n => n.id === edge.target);
    const sourceCompleted = (sourceNode?.data as any)?.task?.completed;
    const targetCompleted = (targetNode?.data as any)?.task?.completed;
    
    const isCompleted = sourceCompleted && targetCompleted;
    
    return {
      ...edge,
      animated: true,
      style: {
        stroke: isCompleted ? '#10b981' : '#b0b0b0',
        strokeWidth: isCompleted ? 4 : 2,
      }
    };
  });

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const newNodes = applyNodeChanges(changes, nds);
        saveCanvas(newNodes, edges);
        return newNodes;
      });
    },
    [edges, saveCanvas]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const newEdges = applyEdgeChanges(changes, eds);
        saveCanvas(nodes, newEdges);
        return newEdges;
      });
    },
    [nodes, saveCanvas]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      triggerHaptic('light');
      setEdges((eds) => {
        const newEdges = addEdge(params, eds);
        saveCanvas(nodes, newEdges);
        return newEdges;
      });
    },
    [nodes, saveCanvas]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const taskId = event.dataTransfer.getData('application/reactflow');
      if (!taskId) return;
      
      // Prevent adding duplicate tasks
      if (nodes.some(n => (n.data as any).taskId === taskId)) {
         triggerHaptic('warning');
         return;
      }

      if (reactFlowWrapper.current) {
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        
        const position = {
          x: event.clientX - reactFlowBounds.left - 130, // half node width
          y: event.clientY - reactFlowBounds.top - 50, // half node height
        };

        const newNode = {
          id: `node-${taskId}-${Date.now()}`,
          type: 'taskNode',
          position,
          data: { taskId },
        };

        setNodes((nds) => {
          const newNodes = nds.concat(newNode);
          saveCanvas(newNodes, edges);
          return newNodes;
        });
        triggerHaptic('success');
      }
    },
    [nodes, edges, saveCanvas]
  );

  // Flatten tasks and subtasks for the sidebar
  const allDraggables = tasks.reduce((acc, task) => {
    acc.push({ ...task, isSubtask: false });
    if (task.subtasks) {
      task.subtasks.forEach(st => {
        // Create a pseudo-task for subtasks so they can be dragged identically
        acc.push({
          id: st.id,
          title: st.title,
          completed: st.completed,
          date: task.date,
          startTime: '',
          endTime: '',
          duration: '',
          color: task.color,
          attendees: [],
          type: task.type,
          isSubtask: true
        } as any);
      });
    }
    return acc;
  }, [] as (Task & { isSubtask: boolean })[]);

  const availableTasks = allDraggables.filter(t => !nodes.some(n => (n.data as any).taskId === t.id));

  return (
    <div className="flex h-full w-full relative bg-[#f4f4f4] dark:bg-[#121212] overflow-hidden animate-in fade-in duration-500">
      
      {/* Top Header for Canvas (Collapsible) */}
      <AnimatePresence>
        {isHeaderVisible && (
          <motion.header 
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl shadow-sm"
          >
            <div className="flex items-center gap-4">
              <button 
                onClick={() => { triggerHaptic('light'); onBack(); }}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-black dark:text-white">{projectName}</h2>
                {isProjectCompleted && (
                  <span className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-full font-bold tracking-wide">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    TAMAMLANDI
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={() => { triggerHaptic('light'); setIsHeaderVisible(false); }}
              className="text-xs font-bold text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white uppercase tracking-wider px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-full"
            >
              Gizle
            </button>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Show Header Button (when hidden) */}
      <AnimatePresence>
        {!isHeaderVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-6 right-6 z-40"
          >
            <button 
              onClick={() => { triggerHaptic('light'); setIsHeaderVisible(true); }}
              className="px-4 py-2 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl shadow-lg border border-black/[0.05] dark:border-white/[0.05] rounded-full text-xs font-bold text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white uppercase tracking-wider transition-colors"
            >
              Başlığı Göster
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
            className={`absolute left-0 top-0 bottom-0 w-64 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-3xl border-r border-black/[0.05] dark:border-white/[0.05] z-30 flex flex-col shadow-2xl ${isHeaderVisible ? 'pt-[73px]' : ''}`}
          >
            <div className="p-4 border-b border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between bg-white/50 dark:bg-black/20">
              <h3 className="font-semibold text-sm text-black dark:text-white tracking-tight">Görevler</h3>
              <button 
                onClick={() => { triggerHaptic('light'); setIsSidebarOpen(false); }}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 hide-scrollbar">
              {availableTasks.length === 0 ? (
                <div className="text-center text-black/40 dark:text-white/40 text-[0.6875rem] mt-6 px-2">
                  Kanvasa eklenecek görev kalmadı.
                </div>
              ) : (
                availableTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', task.id);
                      e.dataTransfer.effectAllowed = 'move';
                      triggerHaptic('light');
                    }}
                    className="px-3 py-2 rounded-[10px] shadow-sm border border-black/5 dark:border-white/5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex items-center justify-between"
                    style={{ backgroundColor: task.color }}
                  >
                    <h4 className={`font-medium text-[12px] truncate pr-2 ${task.isSubtask ? 'text-black/80 italic' : 'text-black/90'}`}>
                      {task.isSubtask && "↳ "}{task.title}
                    </h4>
                    <span className="text-[9px] font-bold text-black/40 shrink-0">
                      {task.startTime || (task.isSubtask ? 'Alt Görev' : '')}
                    </span>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 border-t border-black/[0.05] dark:border-white/[0.05] bg-white/50 dark:bg-black/20">
              <button
                onClick={() => { triggerHaptic('medium'); onAddRequest(); }}
                className="w-full py-2 bg-black dark:bg-white text-white dark:text-black rounded-[12px] font-semibold text-[0.6875rem] flex items-center justify-center gap-1.5 hover:bg-black/80 dark:hover:bg-white/80 transition-colors uppercase tracking-wide"
              >
                <Plus className="w-3.5 h-3.5" /> Yeni Ekle
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand Sidebar Button */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`absolute left-6 z-40 ${isHeaderVisible ? 'top-[97px]' : 'top-6'}`}
          >
            <button
              onClick={() => { triggerHaptic('light'); setIsSidebarOpen(true); }}
              className="w-10 h-10 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl shadow-lg border border-black/[0.05] dark:border-white/[0.05] rounded-full flex items-center justify-center text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* React Flow Canvas */}
      <div className="flex-1 w-full h-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={syncedNodes}
          edges={processedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[#f8f9fa]"
        >
          <Background color="#000000" gap={16} size={1} opacity={0.05} />
          <Controls className="!bg-white/80 !backdrop-blur-xl !border-black/10 !shadow-xl !rounded-2xl overflow-hidden [&>button]:!border-black/5" />
        </ReactFlow>
      </div>

    </div>
  );
}

export default function CanvasView({ tasks, onTaskClick, onAddRequest, onClose }: { tasks: Task[], onTaskClick: (t: Task) => void, onAddRequest: () => void, onClose: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/projects`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const proj = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[];
      // sort by creation date
      proj.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setProjects(proj);
    });
    return unsubscribe;
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    
    const projectId = Date.now().toString();
    const docRef = doc(db, `users/${user.uid}/projects/${projectId}`);
    await setDoc(docRef, {
      name: newProjectName.trim(),
      createdAt: serverTimestamp(),
      nodes: [],
      edges: []
    });
    
    triggerHaptic('success');
    setNewProjectName("");
    setIsCreatingProject(false);
    setSelectedProjectId(projectId);
  };

  if (selectedProjectId) {
    const project = projects.find(p => p.id === selectedProjectId);
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed inset-0 z-50 bg-[#f4f4f4] dark:bg-[#121212] flex flex-col"
      >
        <ReactFlowProvider>
          <CanvasFlow 
            tasks={tasks} 
            projectId={selectedProjectId} 
            projectName={project?.name || 'Proje'} 
            onTaskClick={onTaskClick} 
            onAddRequest={onAddRequest} 
            onBack={() => { triggerHaptic('light'); setSelectedProjectId(null); }}
          />
        </ReactFlowProvider>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 bg-[#e5e5e5] dark:bg-[#000000] flex flex-col items-center justify-start p-6 md:p-12 overflow-y-auto"
    >
      <div className="w-full max-w-4xl flex items-center justify-between mb-12 mt-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { triggerHaptic('light'); onClose(); }}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 transition-colors shadow-lg"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-white">Projeler</h1>
            <p className="text-black/50 dark:text-white/50 text-[0.9375rem] mt-1 font-medium">Kanvas akışlarınızı proje bazlı yönetin.</p>
          </div>
        </div>
        
        <button 
          onClick={() => { triggerHaptic('medium'); setIsCreatingProject(true); }}
          className="px-6 py-3 bg-white dark:bg-[#1c1c1e] text-black dark:text-white border border-black/5 dark:border-white/5 shadow-sm rounded-full font-bold text-[0.8125rem] uppercase tracking-wider hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Yeni Proje
        </button>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map(project => {
          // Determine if completed based on nodes in project
          const isCompleted = project.nodes && project.nodes.length > 0 && project.nodes.every(n => {
             // Look in both tasks and subtasks
             let task = tasks.find(t => t.id === n.data?.taskId);
             if (!task) {
               for (const t of tasks) {
                 if (t.subtasks) {
                   const st = t.subtasks.find(s => s.id === n.data?.taskId);
                   if (st) {
                     task = { ...t, completed: st.completed };
                     break;
                   }
                 }
               }
             }
             return task?.completed;
          });

          return (
            <motion.div
              key={project.id}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { triggerHaptic('light'); setSelectedProjectId(project.id); }}
              className={`bg-white dark:bg-[#1c1c1e] rounded-[32px] p-8 shadow-xl cursor-pointer border-2 transition-colors flex flex-col justify-between min-h-[220px] ${isCompleted ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-transparent'}`}
            >
              <div>
                <h3 className="text-2xl font-semibold text-black/90 dark:text-white/90 tracking-tight leading-tight mb-2">
                  {project.name}
                </h3>
                <p className="text-black/40 dark:text-white/40 text-sm font-medium">
                  {project.nodes?.length || 0} Görev Düğümü
                </p>
              </div>
              
              <div className="flex items-center justify-between mt-8">
                <div className="text-[0.625rem] font-bold text-black/30 dark:text-white/30 uppercase tracking-widest">
                  Kanvas Akışı
                </div>
                {isCompleted && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {isCreatingProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-[#1c1c1e] w-full max-w-md rounded-[32px] p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-semibold text-black dark:text-white tracking-tight mb-6">Yeni Proje Oluştur</h3>
              <form onSubmit={handleCreateProject}>
                <input
                  type="text"
                  autoFocus
                  placeholder="Proje Adı"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full text-xl border-b-2 border-black/10 dark:border-white/10 bg-transparent py-3 focus:outline-none focus:border-black dark:focus:border-white transition-colors font-medium text-black dark:text-white placeholder-black/30 dark:placeholder-white/30 mb-8"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProject(false)}
                    className="flex-1 py-3.5 bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 rounded-full font-bold text-sm hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-sm hover:bg-black/80 dark:hover:bg-white/80 transition-colors shadow-lg"
                  >
                    Oluştur
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
