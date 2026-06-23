import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import {
  collection, onSnapshot, doc, deleteDoc, query, orderBy, limit
} from 'firebase/firestore';
import { db } from '../config/firebase';

export default function ModerationScreen({ navigation }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRoom, setExpandedRoom] = useState(null);

  // Fetch all active rooms
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms'), (snap) => {
      const roomsData = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRooms(roomsData);
      setLoading(false);
    }, (error) => {
      console.error("Moderation Fetch Error:", error);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleCloseRoom = (roomId, roomName) => {
    Alert.alert(
      "Close Room?",
      `Are you sure you want to forcefully close '${roomName}'? This will kick all users out.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close Room", style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'rooms', roomId));
              Alert.alert("Success", "Room has been closed.");
            } catch (error) {
              Alert.alert("Error", error.message);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF3B8B" />
        <Text style={{ color: '#888', marginTop: 10 }}>Loading live rooms...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Moderation Panel</Text>
          <Text style={styles.headerSub}>Monitor Live Rooms & Chats</Text>
        </View>
        <View style={styles.adminBadge}>
          <Ionicons name="shield-half" size={14} color="#FF3B8B" />
          <Text style={styles.adminBadgeText}>MOD</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {rooms.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mic-off-outline" size={50} color="#333" />
            <Text style={styles.emptyText}>No Active Rooms</Text>
          </View>
        ) : (
          rooms.map((room, index) => (
            <RoomCard 
              key={room.id} 
              room={room} 
              isExpanded={expandedRoom === room.id}
              onToggle={() => setExpandedRoom(expandedRoom === room.id ? null : room.id)}
              onCloseRoom={() => handleCloseRoom(room.id, room.title)}
              index={index}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function RoomCard({ room, isExpanded, onToggle, onCloseRoom, index }) {
  const [messages, setMessages] = useState([]);

  // Fetch messages only if expanded to save reads
  useEffect(() => {
    if (!isExpanded) return;
    const q = query(
      collection(db, 'rooms', room.id, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    });
    return unsub;
  }, [isExpanded, room.id]);

  const handleDeleteMessage = (msgId) => {
    Alert.alert("Delete Comment", "Remove this message?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'rooms', room.id, 'messages', msgId));
          } catch (e) {
            Alert.alert("Error", e.message);
          }
        }
      }
    ]);
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} layout={Layout.springify()}>
      <View style={styles.roomCard}>
        
        {/* Room Header Info */}
        <TouchableOpacity style={styles.roomHeader} onPress={onToggle} activeOpacity={0.7}>
          <View style={[styles.avatarBox, { backgroundColor: room.color || '#a78bfa' }]}>
            <Ionicons name="mic" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.roomTitle} numberOfLines={1}>{room.title}</Text>
            <Text style={styles.hostName}>Host: {room.hostName || 'Unknown'}</Text>
          </View>
          <View style={styles.badgeWrap}>
            <Ionicons name="headset" size={12} color="#888" />
            <Text style={styles.badgeText}>{room.listeners || 0}</Text>
          </View>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} color="#666" style={{ marginLeft: 10 }} 
          />
        </TouchableOpacity>

        {/* Expanded Moderation View */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />
            <Text style={styles.chatHeader}>Live Comments</Text>
            
            <View style={styles.chatBox}>
              {messages.length === 0 ? (
                <Text style={styles.noMessages}>No comments yet.</Text>
              ) : (
                messages.map(msg => (
                  <View key={msg.id} style={styles.messageRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.msgUser}>
                        {msg.user} {msg.isSystem ? '(System)' : ''} {msg.isGift ? '🎁' : ''}
                      </Text>
                      <Text style={styles.msgText}>{msg.text}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.deleteMsgBtn}
                      onPress={() => handleDeleteMessage(msg.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF3B3B" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Action Buttons */}
            <TouchableOpacity style={styles.closeRoomBtn} onPress={onCloseRoom}>
              <Ionicons name="close-circle" size={18} color="#fff" />
              <Text style={styles.closeRoomText}>Force Close Room</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 55 : 24, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#888', fontSize: 12, marginTop: 2 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B8B20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#FF3B8B40', gap: 4 },
  adminBadgeText: { color: '#FF3B8B', fontSize: 10, fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 10 },
  
  roomCard: { backgroundColor: '#141414', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1f1f1f', overflow: 'hidden' },
  roomHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  avatarBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roomTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hostName: { color: '#888', fontSize: 13, marginTop: 2 },
  badgeWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
  badgeText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  
  expandedContent: { paddingHorizontal: 16, paddingBottom: 16 },
  divider: { height: 1, backgroundColor: '#1f1f1f', marginBottom: 12 },
  chatHeader: { color: '#aaa', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  chatBox: { backgroundColor: '#0f0f0f', borderRadius: 12, padding: 12, maxHeight: 300, borderWidth: 1, borderColor: '#1a1a1a', marginBottom: 16 },
  noMessages: { color: '#555', fontStyle: 'italic', textAlign: 'center', padding: 20 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', paddingBottom: 8 },
  msgUser: { color: '#60A5FA', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  msgText: { color: '#ddd', fontSize: 14, lineHeight: 20 },
  deleteMsgBtn: { padding: 8, marginLeft: 10, backgroundColor: '#FF3B3B15', borderRadius: 8 },
  
  closeRoomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B3B', paddingVertical: 12, borderRadius: 12, gap: 8 },
  closeRoomText: { color: '#fff', fontSize: 15, fontWeight: '700' }
});
