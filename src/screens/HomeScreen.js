import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import Animated, { FadeInUp, FadeInDown, Layout } from 'react-native-reanimated';
import { db, auth } from '../config/firebase';

const RoomCard = memo(({ item, onPress }) => (
  <Animated.View 
    entering={FadeInUp.duration(400).delay(item.index * 100)} 
    layout={Layout.springify()}
    style={[styles.roomCard, { backgroundColor: item.color || '#a18cd1' }]}
  >
    <TouchableOpacity 
      style={{ flex: 1, justifyContent: 'space-between' }}
      activeOpacity={0.85}
      onPress={() => onPress(item)}
    >
      <View style={styles.roomHeader}>
        <Text style={styles.roomTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.listenerBadge}>
          <Ionicons name="headset" size={12} color="#fff" />
          <Text style={styles.listenerText}>{item.listeners || 0}</Text>
        </View>
      </View>
      
      <View style={styles.hostInfo}>
        <View style={styles.hostAvatar}>
          <Ionicons name="person" size={14} color="#555" />
        </View>
        <Text style={styles.hostName}>{item.hostName}</Text>
      </View>
    </TouchableOpacity>
  </Animated.View>
));

export default function HomeScreen({ navigation }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const roomsData = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        index,
        ...doc.data()
      }));
      // Sort to show newest first or by listeners
      roomsData.sort((a, b) => (b.listeners || 0) - (a.listeners || 0));
      setRooms(roomsData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error: ", error);
      Alert.alert("Database Error", "Make sure you created a Firestore Database in Test Mode on your Firebase Console.\n\n" + error.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      Alert.alert('Error', 'Room name cannot be empty');
      return;
    }
    try {
      const user = auth.currentUser;
      const docRef = await addDoc(collection(db, 'rooms'), {
        title: newRoomName.trim(),
        hostId: user?.uid || 'guest',
        hostName: user?.displayName || 'Anonymous',
        listeners: 1,
        color: ['#FF9A9E', '#a18cd1', '#84fab0', '#fccb90', '#ff9a44'][Math.floor(Math.random() * 5)],
        createdAt: serverTimestamp(),
        seats: Array.from({ length: 8 }).map((_, i) => ({
          id: i.toString(),
          isEmpty: i !== 0, 
          userId: i === 0 ? user?.uid : null,
          userName: i === 0 ? (user?.displayName || 'Host') : ''
        }))
      });
      setNewRoomName('');
      setShowCreate(false);
      navigation.navigate('VoiceRoom', { roomId: docRef.id, roomName: newRoomName.trim(), host: user?.displayName || 'Host' });
    } catch (error) {
      console.error("Error creating room: ", error);
      Alert.alert('Error', 'Failed to create room.');
    }
  };



  const handleRoomPress = useCallback((item) => {
    navigation.navigate('VoiceRoom', { roomId: item.id, roomName: item.title, host: item.hostName });
  }, [navigation]);

  const renderRoom = useCallback(({ item }) => (
    <RoomCard item={item} onPress={handleRoomPress} />
  ), [handleRoomPress]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setShowCreate(!showCreate)} style={styles.iconBtn}>
            <Ionicons name={showCreate ? "close" : "add"} size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {showCreate && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.createRoomContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter room topic..."
            placeholderTextColor="#888"
            value={newRoomName}
            onChangeText={setNewRoomName}
          />
          <TouchableOpacity style={styles.createBtn} onPress={handleCreateRoom}>
            <Text style={styles.createBtnText}>Go Live</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#FF3B8B" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={rooms}
          renderItem={renderRoom}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={<Text style={styles.emptyText}>No active rooms. Create one!</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 15 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  seedBtn: { backgroundColor: '#34C759', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  seedBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  createRoomContainer: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', borderRadius: 14, paddingHorizontal: 15, height: 48, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  createBtn: { backgroundColor: '#FF3B8B', paddingHorizontal: 20, height: 48, justifyContent: 'center', borderRadius: 14, shadowColor: '#FF3B8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  listContainer: { paddingHorizontal: 10, paddingBottom: 40, paddingTop: 10 },
  row: { justifyContent: 'space-between', paddingHorizontal: 10 },
  roomCard: { width: '47%', height: 170, borderRadius: 24, padding: 18, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  roomHeader: { alignItems: 'flex-start' },
  roomTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 12, lineHeight: 22 },
  listenerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backdropFilter: 'blur(10px)' },
  listenerText: { color: '#fff', fontSize: 13, marginLeft: 5, fontWeight: 'bold' },
  hostInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 14 },
  hostAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.8)', marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  hostName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 50, fontSize: 16 }
});
