import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const requiredFields = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
  'storageBucket',
  'messagingSenderId'
];

for (const field of requiredFields) {
  if (!(firebaseConfig as any)[field]) {
    throw new Error(`Firebase configuration error: Missing required field '${field}'`);
  }
}

export const app = initializeApp(firebaseConfig);

const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

export const auth = getAuth(app);
export const storage = getStorage(app);
