import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBKrbc95vsuXzR83AL2XGZh3GqO2Wzz1fo",
  authDomain: "uchat-f883e.firebaseapp.com",
  projectId: "uchat-f883e",
  storageBucket: "uchat-f883e.firebasestorage.app",
  messagingSenderId: "357525841298",
  appId: "1:357525841298:web:1b6ee80fd937ab29c94d4b",
  measurementId: "G-YQ5QPW4XKM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const dummyRooms = [
  { title: '🔥 Chill Vibes Only', hostName: 'Kathan', listeners: 145, color: '#FF9A9E' },
  { title: 'Late Night Music 🎵', hostName: 'DJ Alice', listeners: 320, color: '#a18cd1' },
  { title: 'Let\'s Play Ludo 🎲', hostName: 'GamerX', listeners: 55, color: '#84fab0' },
  { title: 'Poetry & Stories 📖', hostName: 'Sarah', listeners: 89, color: '#fccb90' },
  { title: 'Tech Talk 2026 💻', hostName: 'Alex Dev', listeners: 210, color: '#ff9a44' }
];

async function seed() {
  console.log('Starting to seed database...');
  try {
    for (const room of dummyRooms) {
      await addDoc(collection(db, 'rooms'), {
        title: room.title,
        hostId: 'dummy_' + Math.floor(Math.random() * 10000),
        hostName: room.hostName,
        listeners: room.listeners,
        color: room.color,
        createdAt: serverTimestamp(),
        seats: Array.from({ length: 8 }).map((_, i) => ({
          id: i.toString(),
          isEmpty: i > 3, 
          userId: i <= 3 ? ('dummy_' + Math.floor(Math.random() * 10000)) : null,
          userName: i <= 3 ? `Speaker ${i+1}` : ''
        }))
      });
      console.log(`Created room: ${room.title}`);
    }
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
