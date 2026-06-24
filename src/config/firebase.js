import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Use initializeAuth with React Native persistence to fix
// "Component auth has not been registered yet" error on Android
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  // Already initialized (hot reload)
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export default app;
