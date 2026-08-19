import { Task, DaySchedule } from './types';

export const mockTasks: Task[] = [
  {
    id: '1',
    title: 'You Have\nA Meeting',
    date: '2023-12-13',
    startTime: '3:00 PM',
    endTime: '3:30 PM',
    duration: '30 Min',
    color: '#e7c57f', // yellow
    type: 'meeting',
    attendees: [
      { id: 'u1', avatarUrl: 'https://i.pravatar.cc/150?u=1' },
      { id: 'u2', avatarUrl: 'https://i.pravatar.cc/150?u=2' }
    ]
  },
  {
    id: '2',
    title: 'You Have\nA Meeting',
    date: '2023-12-13',
    startTime: '3:00 PM',
    endTime: '3:30 PM',
    duration: '30 Min',
    color: '#bac5c4', // grey
    type: 'meeting',
    attendees: [
      { id: 'u3', avatarUrl: 'https://i.pravatar.cc/150?u=3' },
      { id: 'u4', avatarUrl: 'https://i.pravatar.cc/150?u=4' }
    ]
  }
];

export const mockSchedules: DaySchedule[] = [
  {
    date: '2023-12-13',
    color: '#b5abd0', // purple
    events: [
      { id: 'e1', time: '3 pm', title: 'Meeting' }
    ]
  },
  {
    date: '2023-12-14',
    color: '#d6a3a4', // pink
    events: [
      { id: 'e2', time: '3 pm', title: 'Meeting' }
    ]
  },
  {
    date: '2023-12-15',
    color: '#a0cec9', // teal
    events: [
      { id: 'e3', time: '3 pm', title: 'Meeting' }
    ]
  },
  {
    date: '2023-12-16',
    color: '#cde4a4', // lime green
    events: [
      { id: 'e4', time: '3 pm', title: 'Meeting' }
    ]
  }
];
