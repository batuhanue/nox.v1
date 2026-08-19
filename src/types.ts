export interface Attendee {
  id: string;
  avatarUrl: string;
}

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "3:00 PM"
  endTime: string; // e.g. "3:30 PM"
  duration: string; // e.g. "30 Min"
  color: string; // tailwind class or hex
  attendees: Attendee[];
  type: 'meeting' | 'task';
  completed?: boolean;
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
