export interface Attendee {
  id: string;
  avatarUrl: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (Scheduled Date)
  dueDate?: string; // YYYY-MM-DD (Deadline)
  startTime?: string; // Made optional for all-day
  endTime?: string;
  duration?: string;
  isAllDay?: boolean;
  recurrence?: 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'custom';
  importance?: 'normal' | 'important' | 'critical';
  rolloverCount?: number;
  status?: 'active' | 'cancelled';
  inbox?: boolean; // True if it is in the inbox (unplanned)
  
  color: string; // tailwind class or hex
  attendees: Attendee[];
  type: 'meeting' | 'task';
  completed?: boolean;
  locationName?: string;
  locationAddress?: string;
  ownerId?: string;
  createdAt?: any;
  updatedAt?: any;
  subtasks?: SubTask[];
  reminders?: { offset: number; notified?: boolean }[];
  attachments?: Attachment[];
  googleEventId?: string;
}

export type CanvasNodeKind = 'task' | 'note' | 'milestone' | 'file' | 'link' | 'checklist' | 'decision' | 'frame';

export interface CanvasNodeData {
  kind: CanvasNodeKind;
  
  // Specific to task
  taskId?: string;

  // General fields
  title?: string;
  content?: string;
  color?: string;

  // File / Link
  attachmentId?: string;
  url?: string;

  // Checklist
  checklist?: {
    id: string;
    text: string;
    completed: boolean;
  }[];

  // Logic fields
  completionRelevant?: boolean;
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  color: string;
  events: {
    id: string;
    time: string; // e.g. "3 pm"
    title: string;
  }[];
}
