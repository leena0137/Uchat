import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function MessagesListScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Listen to chats where current user is a participant
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Determine the other participant's ID
        const otherUserId = data.participants.find(id => id !== user.uid);
        chatList.push({
          id: doc.id,
          otherUserId,
          lastMessage: data.lastMessage || 'Start a conversation',
          updatedAt: data.updatedAt?.toMillis() || Date.now(),
          ...data
        });
      });
      // Sort by latest updated
      chatList.sort((a, b) => b.updatedAt - a.updatedAt);
      setChats(chatList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openChat = (chatId, otherUserId) => {
    navigation.navigate('ChatScreen', { chatId, otherUserId });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.chatItem} onPress={() => openChat(item.id, item.otherUserId)}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color="#fff" />
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>User {item.otherUserId.substring(0,5)}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity>
          <Ionicons name="add" size={28} color="#FF4081" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={{color:'#fff', textAlign:'center', marginTop: 20}}>Loading...</Text>
      ) : chats.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={60} color="#444" />
          <Text style={styles.emptyText}>No messages yet.</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 10 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1014',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    marginBottom: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  lastMessage: {
    color: '#888',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    marginTop: 10,
    fontSize: 16,
  }
});
