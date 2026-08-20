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
  NodeResizer,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Task } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Plus, ChevronLeft, LogOut, CheckCircle2, FileText, Link2, ListTodo, GitMerge, Flag, GripVertical } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, collection, onSnapshot, query, serverTimestamp } from 'firebase/firestore';
import { triggerHaptic } from '../App';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react';

// Custom Edge
const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { relationship = 'RELATES_TO', isCompleted, onChangeType } = data || {};

  const colors: Record<string, string> = {
    RELATES_TO: '#9ca3af',
    DEPENDS_ON: '#3b82f6',
    BLOCKS: '#ef4444',
    REFERENCE: '#8b5cf6'
  };

  const labels: Record<string, string> = {
    RELATES_TO: 'Bağlantılı',
    DEPENDS_ON: 'Buna Bağlı',
    BLOCKS: 'Engelliyor',
    REFERENCE: 'Referans'
  };

  const baseColor = isCompleted ? '#10b981' : (colors[relationship as string] || '#b0b0b0');
  const labelText = labels[relationship as string] || 'Bağlantılı';

  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: baseColor, strokeWidth: isCompleted ? 4 : 2 }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <div className="relative">
            <button
              onClick={() => {
                triggerHaptic('light');
                setShowMenu(!showMenu);
              }}
              className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full bg-white dark:bg-black border shadow-sm uppercase opacity-0 hover:opacity-100 transition-opacity"
              style={{ color: baseColor, borderColor: baseColor }}
            >
              {labelText}
            </button>
            
            {showMenu && (
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white dark:bg-[#1c1c1e] shadow-xl border border-black/10 dark:border-white/10 rounded-[12px] p-2 flex flex-col gap-1 z-50 w-32">
                <span className="text-[9px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 px-1">İlişki</span>
                {Object.keys(labels).map(k => (
                  <button
                    key={k}
                    onClick={() => {
                      triggerHaptic('success');
                      if (typeof onChangeType === "function") onChangeType(id, k);
                      setShowMenu(false);
                    }}
                    className={`text-left text-[11px] font-semibold px-2 py-1.5 rounded-[8px] transition-colors ${relationship === k ? 'bg-black/5 dark:bg-white/5 text-black dark:text-white' : 'text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5'}`}
                  >
                    {labels[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

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

// Custom Node Component for Sticky Notes
const StickyNoteNode = ({ data, id, selected }: NodeProps<Node<{ title?: string, content?: string, color?: string, onChange?: (d: any) => void }>>) => {
  const { title = '', content = '', color = '#fef3c7', onChange } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [localContent, setLocalContent] = useState(content);

  const handleSave = () => {
    setIsEditing(false);
    if (onChange) {
      onChange({ title: localTitle, content: localContent, color });
    }
  };

  return (
    <div 
      className={`rounded-[16px] p-4 shadow-md border-2 transition-all duration-200 w-[220px] min-h-[220px] flex flex-col ${selected ? 'border-black/30 scale-[1.02] shadow-xl' : 'border-black/5'}`}
      style={{ backgroundColor: color }}
      onDoubleClick={() => setIsEditing(true)}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-white border-2 !border-black/20" />
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-white border-2 !border-black/20" />
      
      {isEditing ? (
        <div className="flex flex-col h-full gap-2 relative">
          <input 
            autoFocus
            className="font-bold text-black/80 bg-black/5 border-none outline-none rounded p-1.5 text-sm w-full"
            placeholder="Başlık (isteğe bağlı)"
            value={localTitle}
            onChange={e => setLocalTitle(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setLocalTitle(title); setLocalContent(content); setIsEditing(false);
              }
            }}
          />
          <textarea 
            className="flex-1 font-medium text-black/70 bg-black/5 border-none outline-none rounded p-1.5 text-sm w-full resize-none min-h-[120px]"
            placeholder="Notunuzu yazın... (Kaydetmek için Cmd/Ctrl + Enter)"
            value={localContent}
            onChange={e => setLocalContent(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setLocalTitle(title); setLocalContent(content); setIsEditing(false);
              }
            }}
          />
          <div className="flex justify-between items-center mt-2">
            <div className="flex gap-1.5">
              {['#fef3c7', '#fecdd3', '#dcfce7', '#e0e7ff', '#f3f4f6'].map(c => (
                <button 
                  key={c}
                  onClick={() => onChange && onChange({ color: c })}
                  className={`w-5 h-5 rounded-full border border-black/10 ${color === c ? 'ring-2 ring-black/30 ring-offset-1' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button onClick={handleSave} className="text-[10px] font-bold uppercase tracking-wider bg-black/10 px-2 py-1 rounded">Bitti</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full pointer-events-none cursor-grab">
          {title && <h4 className="font-bold text-black/80 text-sm mb-2 uppercase tracking-wide border-b border-black/10 pb-2">{title}</h4>}
          <p className="font-medium text-black/70 text-sm whitespace-pre-wrap flex-1">{content || <span className="opacity-40 italic">Çift tıklayarak düzenle...</span>}</p>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-white border-2 !border-black/20" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-white border-2 !border-black/20" />
    </div>
  );
};

// Custom Node Component for Frames
const FrameNode = ({ data, id, selected }: NodeProps<Node<{ title?: string, color?: string, onChange?: (d: any) => void }>>) => {
  const { title = 'YENİ ALAN', color = '#f3f4f6', onChange } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);

  const handleSave = () => {
    setIsEditing(false);
    if (onChange) onChange({ title: localTitle });
  };

  return (
    <div 
      className={`rounded-[24px] border-4 transition-colors w-full h-full relative ${selected ? 'border-black/30' : 'border-black/10'}`}
      style={{ backgroundColor: `${color}40` }} // 25% opacity
    >
      <div 
        className="absolute top-0 left-0 right-0 h-12 bg-black/5 rounded-t-[20px] flex items-center px-6 cursor-grab active:cursor-grabbing"
        onDoubleClick={() => setIsEditing(true)}
      >
        {isEditing ? (
          <input 
            autoFocus
            className="font-bold text-black/80 bg-white/50 border-none outline-none rounded p-1 text-sm tracking-widest uppercase w-64"
            value={localTitle}
            onChange={e => setLocalTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setLocalTitle(title); setIsEditing(false);
              }
            }}
          />
        ) : (
          <h3 className="font-bold text-black/60 text-sm tracking-widest uppercase">{title}</h3>
        )}
      </div>
      
      {selected && (
        <div className="absolute top-3 right-4 flex gap-1.5 z-10">
          {['#f3f4f6', '#fef3c7', '#fecdd3', '#dcfce7', '#e0e7ff'].map(c => (
             <button 
               key={c}
               onClick={() => onChange && onChange({ color: c })}
               className={`w-5 h-5 rounded-full border border-black/10 ${color === c ? 'ring-2 ring-black/30 ring-offset-1' : ''}`}
               style={{ backgroundColor: c }}
             />
          ))}
        </div>
      )}
    </div>
  );
};

// Custom Node for Milestone
const MilestoneNode = ({ data, selected }: NodeProps<Node<{ title?: string, color?: string, onChange?: (d: any) => void }>>) => {
  const { title = 'Kilometre Taşı', color = '#000000', onChange } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);

  return (
    <div className={`relative flex items-center justify-center p-3 px-6 rounded-full shadow-lg border-2 ${selected ? 'border-black/30 scale-[1.02]' : 'border-black/5'}`} style={{ backgroundColor: color === '#000000' ? '#111' : color, color: color === '#000000' ? '#fff' : '#000' }} onDoubleClick={() => setIsEditing(true)}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-white border-2 !border-black/20" />
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-white border-2 !border-black/20" />
      <Flag className="w-4 h-4 mr-2" />
      {isEditing ? (
        <input 
          autoFocus className="font-bold bg-transparent border-none outline-none text-sm w-32" style={{ color: color === '#000000' ? '#fff' : '#000' }}
          value={localTitle} onChange={e => setLocalTitle(e.target.value)}
          onBlur={() => { setIsEditing(false); if (onChange) onChange({ title: localTitle }); }}
          onKeyDown={e => { if (e.key === 'Enter') { setIsEditing(false); if (onChange) onChange({ title: localTitle }); } }}
        />
      ) : (
        <span className="font-bold text-sm tracking-wide">{title}</span>
      )}
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-white border-2 !border-black/20" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-white border-2 !border-black/20" />
    </div>
  );
};

// Custom Node for File
const FileNode = ({ data, selected }: NodeProps<Node<{ title?: string, onChange?: (d: any) => void }>>) => {
  const { title = 'Dosya', onChange } = data;
  return (
    <div className={`relative flex items-center p-3 rounded-[12px] shadow-sm bg-white border-2 ${selected ? 'border-blue-500 scale-[1.02]' : 'border-black/5'}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-white border-2 !border-black/20" />
      <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center mr-3">
        <FileText className="w-4 h-4 text-blue-600" />
      </div>
      <span className="font-semibold text-sm text-black/80">{title}</span>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-white border-2 !border-black/20" />
    </div>
  );
};

// Custom Node for Link
const LinkNode = ({ data, selected }: NodeProps<Node<{ title?: string, url?: string, onChange?: (d: any) => void }>>) => {
  const { title = 'Bağlantı', url = '', onChange } = data;
  return (
    <div className={`relative flex items-center p-3 rounded-[12px] shadow-sm bg-white border-2 ${selected ? 'border-emerald-500 scale-[1.02]' : 'border-black/5'}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-white border-2 !border-black/20" />
      <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center mr-3">
        <Link2 className="w-4 h-4 text-emerald-600" />
      </div>
      <div className="flex flex-col">
        <span className="font-semibold text-sm text-black/80">{title}</span>
        {url && <span className="text-[10px] text-black/40 truncate w-32">{url}</span>}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-white border-2 !border-black/20" />
    </div>
  );
};

// Custom Node for Checklist
const ChecklistNode = ({ data, selected }: NodeProps<Node<{ title?: string, checklist?: {id: string, text: string, completed: boolean}[], onChange?: (d: any) => void }>>) => {
  const { title = 'Kontrol Listesi', checklist = [{id: '1', text: 'Öğe 1', completed: false}], onChange } = data;
  return (
    <div className={`relative flex flex-col p-4 rounded-[16px] shadow-sm bg-white border-2 min-w-[200px] ${selected ? 'border-purple-500 scale-[1.02]' : 'border-black/5'}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-white border-2 !border-black/20" />
      <div className="flex items-center gap-2 mb-3">
        <ListTodo className="w-4 h-4 text-purple-600" />
        <span className="font-bold text-sm text-black/80">{title}</span>
      </div>
      <div className="flex flex-col gap-2">
        {checklist.map(item => (
          <div key={item.id} className="flex items-start gap-2">
            <div onClick={() => {
              if(onChange) {
                const newC = checklist.map(c => c.id === item.id ? {...c, completed: !c.completed} : c);
                onChange({ checklist: newC });
              }
            }} className="mt-0.5 cursor-pointer shrink-0">
              {item.completed ? <CheckCircle2 className="w-4 h-4 text-purple-600" /> : <div className="w-4 h-4 border-2 border-black/20 rounded-full" />}
            </div>
            <span className={`text-xs font-medium ${item.completed ? 'text-black/40 line-through' : 'text-black/70'}`}>{item.text}</span>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-white border-2 !border-black/20" />
    </div>
  );
};

// Custom Node for Decision
const DecisionNode = ({ data, selected }: NodeProps<Node<{ title?: string, onChange?: (d: any) => void }>>) => {
  const { title = 'Karar / Koşul', onChange } = data;
  return (
    <div className={`relative flex items-center justify-center p-4 rounded-[8px] rotate-45 shadow-sm bg-white border-2 w-24 h-24 ${selected ? 'border-orange-500 scale-[1.02]' : 'border-black/5'}`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-white border-2 !border-black/20 -rotate-45" />
      <div className="-rotate-45 flex flex-col items-center text-center">
        <GitMerge className="w-4 h-4 text-orange-600 mb-1" />
        <span className="font-bold text-[10px] text-black/80 leading-tight">{title}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-white border-2 !border-black/20 -rotate-45" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-white border-2 !border-black/20 -rotate-45" />
    </div>
  );
};

const nodeTypes = {
  taskNode: TaskNode,
  stickyNote: StickyNoteNode,
  frameNode: FrameNode,
  milestoneNode: MilestoneNode,
  fileNode: FileNode,
  linkNode: LinkNode,
  checklistNode: ChecklistNode,
  decisionNode: DecisionNode,
};

const edgeTypes = {
  customEdge: CustomEdge,
};

interface Project {
  id: string;
  name: string;
  goal?: string;
  createdAt: any;
  nodes?: any[];
  edges?: any[];
}

function CanvasFlow({ tasks, projectId, projectName, onTaskClick, onAddRequest, onBack }: { tasks: Task[], projectId: string, projectName: string, onTaskClick: (t: Task) => void, onAddRequest: () => void, onBack: () => void }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [projectGoal, setProjectGoal] = useState('');
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
        if (data.goal) setProjectGoal(data.goal);
      }
    };
    loadCanvas();
  }, [projectId]);

  // Save canvas state
  const saveCanvas = useCallback(async (n: Node[], e: Edge[]) => {
    const user = auth.currentUser;
    if (!user) return;
    const docRef = doc(db, `users/${user.uid}/projects/${projectId}`);
    const cleanNodes = n.map(node => {
      const cleanData: any = { ...node.data };
      delete cleanData.task;
      delete cleanData.onTaskClick;
      delete cleanData.onChange;
      
      return {
        id: node.id,
        type: node.type,
        position: node.position,
        width: node.width,
        height: node.height,
        data: cleanData
      };
    });
    await setDoc(docRef, { nodes: cleanNodes, edges: e }, { merge: true });
  }, [projectId]);

  const saveGoal = async (goal: string) => {
    setProjectGoal(goal);
    const user = auth.currentUser;
    if (!user) return;
    const docRef = doc(db, `users/${user.uid}/projects/${projectId}`);
    await setDoc(docRef, { goal }, { merge: true });
  };

  // Sync node data with latest task data
  const syncedNodes = nodes.map(node => {
    const data = node.data as any;
    const kind = data.kind || (data.taskId ? 'task' : 'note');

    if (kind === 'task' && data.taskId) {
      const taskId = data.taskId;
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
        data: { ...data, kind, task, onTaskClick: (_t: any) => onTaskClick(originalTask || task!) }
      };
    }
    
    // For non-task nodes
    return {
      ...node,
      data: { ...data, kind, onChange: (newData: any) => {
        setNodes(nds => {
          const newNodes = nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, ...newData } } : n);
          // Manually trigger save here since we bypassed onNodesChange
          saveCanvas(newNodes, edges);
          return newNodes;
        });
      }}
    };
  });

  // Calculate completion nodes
  const completionNodes = syncedNodes.filter(n => {
    const kind = (n.data as any).kind;
    const isRelevant = (n.data as any).completionRelevant;
    if (isRelevant !== undefined) return isRelevant;
    // Default behaviors
    return kind === 'task' || kind === 'milestone';
  });

  // Check if project is completed (all relevant nodes in canvas are completed and there is at least one)
  const isProjectCompleted = completionNodes.length > 0 && completionNodes.every(n => (n.data as any).task?.completed);

  // Calculate flow completion (animated edges turning green)
  const processedEdges = edges.map(edge => {
    const sourceNode = syncedNodes.find(n => n.id === edge.source);
    const targetNode = syncedNodes.find(n => n.id === edge.target);
    const sourceTask = (sourceNode?.data as any)?.task;
    const targetTask = (targetNode?.data as any)?.task;
    
    let sourceCompleted = sourceTask?.completed;
    if (edge.sourceHandle && edge.sourceHandle.startsWith('st-source-')) {
      const stId = edge.sourceHandle.replace('st-source-', '');
      const st = sourceTask?.subtasks?.find((s: any) => s.id === stId);
      if (st) sourceCompleted = st.completed;
    }

    let targetCompleted = targetTask?.completed;
    if (edge.targetHandle && edge.targetHandle.startsWith('st-target-')) {
      const stId = edge.targetHandle.replace('st-target-', '');
      const st = targetTask?.subtasks?.find((s: any) => s.id === stId);
      if (st) targetCompleted = st.completed;
    }
    
    const isCompleted = sourceCompleted && targetCompleted;
    
    return {
      ...edge,
      type: edge.type || 'customEdge',
      animated: true,
      data: {
        ...edge.data,
        isCompleted,
        onChangeType: (edgeId: string, type: string) => {
          setEdges(eds => {
            const newEdges = eds.map(e => e.id === edgeId ? { ...e, data: { ...e.data, relationship: type } } : e);
            saveCanvas(nodes, newEdges);
            return newEdges;
          });
        }
      },
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
        const newEdges = addEdge({ ...params, type: 'customEdge' }, eds);
        saveCanvas(nodes, newEdges);
        return newEdges;
      });
    },
    [nodes, saveCanvas]
  );

  const addNodeToCanvas = useCallback((payload: any, position: { x: number, y: number }) => {
    let newNode: Node;

    if (payload.kind === 'task') {
      const taskId = payload.id;
      if (nodes.some(n => (n.data as any).taskId === taskId)) {
         triggerHaptic('warning');
         return;
      }
      newNode = {
        id: `node-${taskId}-${Date.now()}`,
        type: 'taskNode',
        position,
        data: { taskId, kind: 'task' },
      };
    } else if (payload.kind === 'note') {
      newNode = {
        id: `node-${Date.now()}`,
        type: 'stickyNote',
        position,
        data: { kind: 'note', title: '', content: '', color: '#fef3c7' },
      };
    } else if (payload.kind === 'frame') {
      newNode = {
        id: `node-${Date.now()}`,
        type: 'frameNode',
        position,
        style: { width: 400, height: 300, zIndex: -1 },
        data: { kind: 'frame', title: 'YENİ ALAN', color: '#f3f4f6' },
      };
    } else if (payload.kind === 'milestone') {
      newNode = {
        id: `node-${Date.now()}`,
        type: 'milestoneNode',
        position,
        data: { kind: 'milestone', title: 'Kilometre Taşı', color: '#000000', completionRelevant: true },
      };
    } else if (payload.kind === 'file') {
      newNode = {
        id: `node-${Date.now()}`,
        type: 'fileNode',
        position,
        data: { kind: 'file', title: 'Dosya', completionRelevant: false },
      };
    } else if (payload.kind === 'link') {
      newNode = {
        id: `node-${Date.now()}`,
        type: 'linkNode',
        position,
        data: { kind: 'link', title: 'Bağlantı', url: 'https://', completionRelevant: false },
      };
    } else if (payload.kind === 'checklist') {
      newNode = {
        id: `node-${Date.now()}`,
        type: 'checklistNode',
        position,
        data: { kind: 'checklist', title: 'Kontrol Listesi', checklist: [{id: '1', text: 'Öğe 1', completed: false}], completionRelevant: false },
      };
    } else if (payload.kind === 'decision') {
      newNode = {
        id: `node-${Date.now()}`,
        type: 'decisionNode',
        position,
        data: { kind: 'decision', title: 'Karar / Koşul', completionRelevant: false },
      };
    } else {
      return;
    }

    setNodes((nds) => {
      const newNodes = nds.concat(newNode);
      saveCanvas(newNodes, edges);
      return newNodes;
    });
    triggerHaptic('success');
  }, [nodes, edges, saveCanvas]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const rawData = event.dataTransfer.getData('application/reactflow');
      if (!rawData) return;
      
      let payload;
      try {
        payload = JSON.parse(rawData);
      } catch (e) {
        // backward compatibility
        payload = { kind: 'task', id: rawData };
      }

      if (reactFlowWrapper.current) {
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        
        const position = {
          x: event.clientX - reactFlowBounds.left - 130, // half node width approx
          y: event.clientY - reactFlowBounds.top - 50, // half node height approx
        };

        addNodeToCanvas(payload, position);
      }
    },
    [addNodeToCanvas]
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
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { triggerHaptic('light'); onBack(); }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold tracking-tight text-black dark:text-white shrink-0">{projectName}</h2>
                  {isProjectCompleted && (
                    <span className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-full font-bold tracking-wide shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      TAMAMLANDI
                    </span>
                  )}
                </div>
              </div>
              <div className="pl-14 max-w-xl">
                <span className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest block mb-0.5">Amaç</span>
                <input 
                  type="text" 
                  value={projectGoal} 
                  onChange={(e) => setProjectGoal(e.target.value)}
                  onBlur={() => saveGoal(projectGoal)}
                  placeholder="Bu projenin temel amacı nedir?"
                  className="w-full bg-transparent border-none outline-none text-sm font-medium text-black/80 dark:text-white/80 placeholder:text-black/30 dark:placeholder:text-white/30 truncate"
                />
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
              
              {/* Tools Section */}
              <div className="mb-2">
                <h4 className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-2 px-1">Araçlar</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', JSON.stringify({ kind: 'note' }));
                      e.dataTransfer.effectAllowed = 'move';
                      triggerHaptic('light');
                    }}
                    onClick={() => {
                      const pos = reactFlowWrapper.current ? { x: reactFlowWrapper.current.clientWidth / 2 - 50, y: reactFlowWrapper.current.clientHeight / 2 - 50 } : { x: 100, y: 100 };
                      addNodeToCanvas({ kind: 'note' }, pos);
                    }}
                    className="px-3 py-2 rounded-[10px] shadow-sm border border-black/5 dark:border-white/5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex items-center justify-center bg-[#fef3c7] text-[#92400e]"
                  >
                    <span className="text-[11px] font-bold tracking-wide">Not</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', JSON.stringify({ kind: 'frame' }));
                      e.dataTransfer.effectAllowed = 'move';
                      triggerHaptic('light');
                    }}
                    onClick={() => {
                      const pos = reactFlowWrapper.current ? { x: reactFlowWrapper.current.clientWidth / 2 - 50, y: reactFlowWrapper.current.clientHeight / 2 - 50 } : { x: 100, y: 100 };
                      addNodeToCanvas({ kind: 'frame' }, pos);
                    }}
                    className="px-3 py-2 rounded-[10px] shadow-sm border border-black/10 dark:border-white/10 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex items-center justify-center bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70"
                  >
                    <span className="text-[11px] font-bold tracking-wide uppercase">Alan</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', JSON.stringify({ kind: 'milestone' }));
                      e.dataTransfer.effectAllowed = 'move';
                      triggerHaptic('light');
                    }}
                    onClick={() => {
                      const pos = reactFlowWrapper.current ? { x: reactFlowWrapper.current.clientWidth / 2 - 50, y: reactFlowWrapper.current.clientHeight / 2 - 50 } : { x: 100, y: 100 };
                      addNodeToCanvas({ kind: 'milestone' }, pos);
                    }}
                    className="px-3 py-2 rounded-[10px] shadow-sm border border-black/10 dark:border-white/10 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex items-center justify-center bg-black dark:bg-white text-white dark:text-black"
                  >
                    <Flag className="w-3 h-3 mr-1" />
                    <span className="text-[11px] font-bold tracking-wide uppercase">Milestone</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', JSON.stringify({ kind: 'checklist' }));
                      e.dataTransfer.effectAllowed = 'move';
                      triggerHaptic('light');
                    }}
                    onClick={() => {
                      const pos = reactFlowWrapper.current ? { x: reactFlowWrapper.current.clientWidth / 2 - 50, y: reactFlowWrapper.current.clientHeight / 2 - 50 } : { x: 100, y: 100 };
                      addNodeToCanvas({ kind: 'checklist' }, pos);
                    }}
                    className="px-3 py-2 rounded-[10px] shadow-sm border border-purple-500/20 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex items-center justify-center bg-purple-500/10 text-purple-600"
                  >
                    <ListTodo className="w-3 h-3 mr-1" />
                    <span className="text-[11px] font-bold tracking-wide">Checklist</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', JSON.stringify({ kind: 'file' }));
                      e.dataTransfer.effectAllowed = 'move';
                      triggerHaptic('light');
                    }}
                    onClick={() => {
                      const pos = reactFlowWrapper.current ? { x: reactFlowWrapper.current.clientWidth / 2 - 50, y: reactFlowWrapper.current.clientHeight / 2 - 50 } : { x: 100, y: 100 };
                      addNodeToCanvas({ kind: 'file' }, pos);
                    }}
                    className="px-3 py-2 rounded-[10px] shadow-sm border border-blue-500/20 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex items-center justify-center bg-blue-500/10 text-blue-600"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    <span className="text-[11px] font-bold tracking-wide">Dosya</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', JSON.stringify({ kind: 'link' }));
                      e.dataTransfer.effectAllowed = 'move';
                      triggerHaptic('light');
                    }}
                    onClick={() => {
                      const pos = reactFlowWrapper.current ? { x: reactFlowWrapper.current.clientWidth / 2 - 50, y: reactFlowWrapper.current.clientHeight / 2 - 50 } : { x: 100, y: 100 };
                      addNodeToCanvas({ kind: 'link' }, pos);
                    }}
                    className="px-3 py-2 rounded-[10px] shadow-sm border border-emerald-500/20 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex items-center justify-center bg-emerald-500/10 text-emerald-600"
                  >
                    <Link2 className="w-3 h-3 mr-1" />
                    <span className="text-[11px] font-bold tracking-wide">Bağlantı</span>
                  </div>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', JSON.stringify({ kind: 'decision' }));
                      e.dataTransfer.effectAllowed = 'move';
                      triggerHaptic('light');
                    }}
                    onClick={() => {
                      const pos = reactFlowWrapper.current ? { x: reactFlowWrapper.current.clientWidth / 2 - 50, y: reactFlowWrapper.current.clientHeight / 2 - 50 } : { x: 100, y: 100 };
                      addNodeToCanvas({ kind: 'decision' }, pos);
                    }}
                    className="px-3 py-2 rounded-[10px] shadow-sm border border-orange-500/20 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex items-center justify-center bg-orange-500/10 text-orange-600 col-span-2"
                  >
                    <GitMerge className="w-3 h-3 mr-1" />
                    <span className="text-[11px] font-bold tracking-wide uppercase">Karar / Koşul</span>
                  </div>
                </div>
              </div>

              <h4 className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-1 px-1 mt-2">Görevler</h4>
              {availableTasks.length === 0 ? (
                <div className="text-center text-black/40 dark:text-white/40 text-[0.6875rem] mt-4 px-2">
                  Kanvasa eklenecek görev kalmadı.
                </div>
              ) : (
                availableTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', JSON.stringify({ kind: 'task', id: task.id }));
                      e.dataTransfer.effectAllowed = 'move';
                      triggerHaptic('light');
                    }}
                    onClick={() => {
                      const pos = reactFlowWrapper.current ? { x: reactFlowWrapper.current.clientWidth / 2 - 50, y: reactFlowWrapper.current.clientHeight / 2 - 50 } : { x: 100, y: 100 };
                      addNodeToCanvas({ kind: 'task', id: task.id }, pos);
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
          onNodesChange={onNodesChange as any}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[#f8f9fa]"
        >
          <Background color="#000000" gap={16} size={1}  />
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
          const relevantNodes = (project.nodes || []).filter(n => {
            const kind = n.data?.kind || (n.data?.taskId ? 'task' : 'note');
            if (n.data?.completionRelevant !== undefined) return n.data.completionRelevant;
            return kind === 'task' || kind === 'milestone';
          });

          const isCompleted = relevantNodes.length > 0 && relevantNodes.every(n => {
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
