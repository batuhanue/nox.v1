import express from 'express';
import { createServer as createViteServer } from 'vite';
import webpush from 'web-push';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import crypto from 'crypto';

// Initialize Firebase Admin for backend security
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'studio-4329353910-71110';
admin.initializeApp({
  projectId: FIREBASE_PROJECT_ID,
});

// Encryption logic
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text: string) {
  let iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substring(0, 32);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  let textParts = text.split(':');
  let iv = Buffer.from(textParts.shift()!, 'hex');
  let encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substring(0, 32);
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Authentication middleware
async function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Initialize VAPID Keys
const VAPID_KEYS_FILE = path.join(process.cwd(), 'vapidKeys.json');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
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
  const now = new Date();

  for (const userId of Object.keys(store.userTasks)) {
    const tasks = store.userTasks[userId];
    const sub = store.subscriptions[userId];
    if (!sub) continue;

    for (const task of tasks) {
      if (task.completed) continue;
      if (!task.date) continue;
      
      const reminders = task.reminders || [
        { offset: -1440 }, // 1 day before
        { offset: -60 }    // 1 hour before
      ];
      
      let targetDate = new Date(task.date);
      if (task.startTime) {
        const [hours, mins] = task.startTime.split(':');
        targetDate.setHours(parseInt(hours, 10) || 9, parseInt(mins, 10) || 0, 0, 0);
      } else {
        targetDate.setHours(9, 0, 0, 0); // Default to 9 AM if no time specified
      }

      for (let i = 0; i < reminders.length; i++) {
        const reminder = reminders[i];
        const reminderKey = `${task.id}-${reminder.offset}`;
        
        if (store.notifiedTasks[reminderKey]) continue;
        
        const reminderTime = new Date(targetDate.getTime() + reminder.offset * 60000);
        const diffMinutes = (now.getTime() - reminderTime.getTime()) / 60000;
        
        // Trigger if we're past the reminder time, but not more than 60 minutes past
        if (diffMinutes >= 0 && diffMinutes <= 60) {
          let timeText = 'Yakında';
          if (reminder.offset === -1440) timeText = '1 gün sonra';
          else if (reminder.offset === -120) timeText = '2 saat sonra';
          else if (reminder.offset === -60) timeText = '1 saat sonra';
          else if (reminder.offset === -15) timeText = '15 dakika sonra';
          else if (reminder.offset === 0) timeText = 'Şimdi';

          const payload = JSON.stringify({
            title: 'Nox Hatırlatıcı',
            body: `"${task.title}" görevi ${timeText} başlıyor.`,
            tag: reminderKey,
            url: '/',
          });

          console.log(`Sending notification to user ${userId} for task ${task.id} (offset ${reminder.offset})`);
          webpush.sendNotification(sub, payload).then(() => {
            store.notifiedTasks[reminderKey] = true;
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

// Periodic check for upcoming deadlines (runs every minute)
setInterval(checkAndSendNotifications, 60 * 1000); 


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

app.post('/api/ai/recommend', async (req, res) => {
  try {
    const { tasks, todayStr } = req.body;
    const prompt = `
      Sen profesyonel bir asistan ve zaman yönetimi uzmanısın. Kullanıcının günlük, haftalık ve aylık görev planını, alt görevleri, süreleri, yoğunlukları, varsa projeleri analiz et. 
      Özellikle görevlerin yoğunluğu ile kalan süreyi karşılaştırıp zamanında yetişip yetişmeyeceği konusunda pratik öneriler sun.
      Görevler:
      ${JSON.stringify(tasks, null, 2)}
      
      Bugünün tarihi: ${todayStr}
      
      Lütfen markdown formatında sadece önerilerini içeren kısa, net ve teşvik edici bir değerlendirme yaz.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    
    res.json({ recommendation: response.text });
  } catch (error: any) {
    console.error("AI Recommendation error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    
    const contents = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: "Sen kullanıcının üretkenliğini artırmaya yardımcı olan, nox adlı zaman yönetimi ve verimlilik uygulamasında çalışan bir AI asistanısın. Kısa, samimi ve hedefe yönelik cevaplar ver."
      }
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error("AI Chat error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.post('/api/tokens/encrypt', authenticateToken, (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });
    const encrypted = encrypt(token);
    res.json({ encrypted });
  } catch (err) {
    console.error('Encryption failed:', err);
    res.status(500).json({ error: 'Encryption failed' });
  }
});

app.post('/api/tokens/decrypt', authenticateToken, (req, res) => {
  try {
    const { encrypted } = req.body;
    if (!encrypted) return res.status(400).json({ error: 'Encrypted token is required' });
    const token = decrypt(encrypted);
    res.json({ token });
  } catch (err) {
    console.error('Decryption failed:', err);
    res.status(500).json({ error: 'Decryption failed' });
  }
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
