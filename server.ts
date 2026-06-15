import express from 'express';
import { createServer as createViteServer } from 'vite';
import webpush from 'web-push';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';

// Initialize VAPID Keys
const VAPID_KEYS_FILE = path.join(process.cwd(), 'vapidKeys.json');
let vapidKeys: { publicKey: string, privateKey: string };

if (fs.existsSync(VAPID_KEYS_FILE)) {
  vapidKeys = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, 'utf-8'));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys));
}

// In production, you would want to set an email
webpush.setVapidDetails(
  'mailto:btubasar@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Persistence for subscriptions and tasks
const STORE_FILE = path.join(process.cwd(), 'store.json');
let store: { 
  subscriptions: Record<string, any>, 
  userTasks: Record<string, any[]>, 
  notifiedTasks: Record<string, boolean> 
} = {
  subscriptions: {},
  userTasks: {},
  notifiedTasks: {}
};

if (fs.existsSync(STORE_FILE)) {
  try {
    store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
  } catch (e) {
    console.error('Failed to load store:', e);
  }
}

function saveStore() {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store));
}

app.get('/api/push/vapidPublicKey', (req, res) => {
  res.send(vapidKeys.publicKey);
});

app.post('/api/push/register', (req, res) => {
  const { userId, subscription } = req.body;
  if (!userId || !subscription) return res.status(400).send({});
  store.subscriptions[userId] = subscription;
  saveStore();
  res.status(201).json({});
});

app.post('/api/push/sync', (req, res) => {
  const { userId, tasks } = req.body;
  if (!userId || !tasks) return res.status(400).send({});
  store.userTasks[userId] = tasks;
  saveStore();
  
  // Trigger immediate check after sync
  checkAndSendNotifications();
  
  res.status(200).json({});
});

function checkAndSendNotifications() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const userId of Object.keys(store.userTasks)) {
    const tasks = store.userTasks[userId];
    const sub = store.subscriptions[userId];
    if (!sub) continue;

    for (const task of tasks) {
      if (!task.completed && task.dueDate && !store.notifiedTasks[task.id]) {
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        console.log(`Checking task: ${task.title}, diffDays: ${diffDays}`);

        // Notify if due today, or in 1-3 days
        if (diffDays >= 0 && diffDays <= 3) {
          const dayText = diffDays === 0 ? 'bugün' : `${diffDays} gün sonra`;
          const payload = JSON.stringify({
            title: 'Nox Görev Hatırlatıcısı',
            body: `"${task.title}" görevi ${dayText} sona eriyor.`,
            tag: task.id,
            url: '/',
          });

          console.log(`Sending notification to user ${userId} for task ${task.id}`);
          webpush.sendNotification(sub, payload).then(() => {
            store.notifiedTasks[task.id] = true;
            saveStore();
          }).catch(err => {
            console.error('Push notification failed.', err);
            if (err.statusCode === 410) {
              delete store.subscriptions[userId];
              saveStore();
            }
          });
        }
      }
    }
  }
}

// Periodic check for upcoming deadlines
setInterval(checkAndSendNotifications, 30 * 1000); 


app.get('/api/push/status', (req, res) => {
  res.json({
    subscriptionCount: Object.keys(store.subscriptions).length,
    userTaskCount: Object.keys(store.userTasks).length,
    notifiedTaskCount: Object.keys(store.notifiedTasks).length,
    subscriptions: store.subscriptions,
    userTasks: store.userTasks,
    notifiedTasks: store.notifiedTasks
  });
});

app.post('/api/push/test', (req, res) => {
  const { userId } = req.body;
  const sub = store.subscriptions[userId];
  if (!sub) return res.status(404).json({ error: 'No subscription found' });

  const payload = JSON.stringify({
    title: 'Nox Test Bildirimi',
    body: 'Bu bir test bildirimidir. Sistem çalışıyor!',
    tag: 'test-' + Date.now(),
    url: '/',
  });

  webpush.sendNotification(sub, payload)
    .then(() => res.status(200).json({ success: true }))
    .catch(err => {
      console.error('Test push failed', err);
      res.status(500).json({ error: err.message });
    });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
