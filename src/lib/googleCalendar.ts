import { Task } from '../types';
import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

function getNextDayStr(dateStr: string) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

export async function syncGoogleCalendar(accessToken: string, userId: string, localTasks: Task[]) {
  const minDate = new Date();
  minDate.setMonth(minDate.getMonth() - 1);
  const timeMin = minDate.toISOString();
  // Fetch events including deleted ones
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=2500&showDeleted=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    console.error('Failed to fetch calendar events', await res.text());
    return;
  }
  const data = await res.json();
  const events = data.items || [];

  const localTasksByGEventId = new Map(
    localTasks.filter(t => t.googleEventId).map(t => [t.googleEventId, t])
  );

  for (const event of events) {
    if (event.status === 'cancelled') {
        const existing = localTasksByGEventId.get(event.id);
        if (existing) {
            await deleteDoc(doc(db, `users/${userId}/tasks`, existing.id));
        }
        continue;
    }

    const eventDate = event.start.date || event.start.dateTime.split('T')[0];
    let startTime = undefined;
    let endTime = undefined;
    let isAllDay = true;

    if (event.start.dateTime) {
        const start = new Date(event.start.dateTime);
        const end = new Date(event.end.dateTime);
        startTime = start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        endTime = end.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        isAllDay = false;
    }

    let title = event.summary || 'Başlıksız Etkinlik';
    let isCompleted = false;
    
    // Check if event is marked as completed
    if (title.startsWith('✅ ')) {
        isCompleted = true;
        title = title.replace('✅ ', '');
    } else if (title.startsWith('✅')) {
        isCompleted = true;
        title = title.replace('✅', '').trim();
    }

    const taskData: Partial<Task> = {
      title: title,
      date: eventDate,
      isAllDay,
      type: 'meeting',
      color: '#e5e5e5',
      completed: isCompleted,
      googleEventId: event.id
    };

    if (startTime !== undefined) taskData.startTime = startTime;
    if (endTime !== undefined) taskData.endTime = endTime;
    if (event.location !== undefined && event.location !== null) taskData.locationName = event.location;

    const existingTask = localTasksByGEventId.get(event.id);
    if (!existingTask) {
        const newRef = doc(collection(db, `users/${userId}/tasks`));
        await setDoc(newRef, {
            ...taskData,
            id: newRef.id,
            ownerId: userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            attendees: []
        });
    } else {
        const gUpdated = new Date(event.updated).getTime();
        const lUpdated = existingTask.updatedAt?.toMillis?.() || 0;
        
        if (gUpdated > lUpdated + 5000) {
           await updateDoc(doc(db, `users/${userId}/tasks`, existingTask.id), {
               ...taskData,
               updatedAt: serverTimestamp()
           });
        }
    }
  }
}

export async function createGoogleEvent(accessToken: string, task: Partial<Task>) {
    if (!task.title) return null;
    const summary = task.completed ? `✅ ${task.title}` : task.title;
    const event: any = {
        summary: summary,
        location: task.locationName || undefined,
    };

    if (task.isAllDay || !task.startTime) {
        event.start = { date: task.date };
        event.end = { date: task.date ? getNextDayStr(task.date) : task.date };
    } else {
        const startStr = `${task.date}T${task.startTime}:00`;
        event.start = { dateTime: new Date(startStr).toISOString() };
        if (task.endTime) {
            const endStr = `${task.date}T${task.endTime}:00`;
            event.end = { dateTime: new Date(endStr).toISOString() };
        } else {
            const d = new Date(startStr);
            d.setHours(d.getHours() + 1);
            event.end = { dateTime: d.toISOString() };
        }
    }

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
    });

    if (res.ok) {
        const data = await res.json();
        return data.id;
    }
    return null;
}

export async function updateGoogleEvent(accessToken: string, googleEventId: string, task: Partial<Task>) {
    if (!task.title) return;
    const summary = task.completed ? `✅ ${task.title}` : task.title;
    const event: any = {
        summary: summary,
        location: task.locationName || undefined,
    };

    if (task.isAllDay || !task.startTime) {
        event.start = { date: task.date };
        event.end = { date: task.date ? getNextDayStr(task.date) : task.date };
    } else {
        const startStr = `${task.date}T${task.startTime}:00`;
        event.start = { dateTime: new Date(startStr).toISOString() };
        if (task.endTime) {
            const endStr = `${task.date}T${task.endTime}:00`;
            event.end = { dateTime: new Date(endStr).toISOString() };
        } else {
            const d = new Date(startStr);
            d.setHours(d.getHours() + 1);
            event.end = { dateTime: d.toISOString() };
        }
    }

    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
    });
}

export async function deleteGoogleEvent(accessToken: string, googleEventId: string) {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
    });
}
