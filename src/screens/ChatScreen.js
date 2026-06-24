import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../config/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, setDoc } from 'firebase/firestore';

export default function ChatScreen({ route, navigation }) {
  const { chatId, otherUserId } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const flatListRef = useRef();
  
  // Create chat document if it doesn't exist
  useEffect(() => {
    const initializeChat = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      const chatRef = doc(db, 'chats', chatId);
      try {
        await setDoc(chatRef, {
          participants: [user.uid, otherUserId],
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error("Error init chat:", e);
      }
    };
    initializeChat();
  }, [chatId, otherUserId]);

  useEffect(() => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const user = auth.currentUser;
    if (!user) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      // Add message
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });

      // Update chat lastMessage
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text,
        updatedAt: serverTimestamp()
      });
      
    } catch (error) {
      console.error('Error sending message: ', error);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === auth.currentUser?.uid;
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={styles.messageText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={{width: 24}} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#888"
          />
          <TouchableOpacity 
            style={[styles.sendButton, !newMessage.trim() && {opacity: 0.5}]} 
            onPress={sendMessage}
            disabled={!newMessage.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesList: {
    padding: 15,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF4081',
    borderBottomRightRadius: 5,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#FF4081',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
