import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBKrbc95vsuXzR83AL2XGZh3GqO2Wzz1fo",
  authDomain: "uchat-f883e.firebaseapp.com",
  projectId: "uchat-f883e",
  storageBucket: "uchat-f883e.firebasestorage.app",
  messagingSenderId: "357525841298",
  appId: "1:357525841298:web:1b6ee80fd937ab29c94d4b",
  measurementId: "G-YQ5QPW4XKM"
};

// Prevent duplicate initialization on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
