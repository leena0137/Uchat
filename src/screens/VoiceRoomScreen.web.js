import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ImageBackground, TextInput, Alert, FlatList } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { doc, onSnapshot, collection, addDoc, serverTimestamp, updateDoc, query, orderBy, limit, setDoc } from 'firebase/firestore';
import Animated, { FadeInDown, FadeIn, BounceIn } from 'react-native-reanimated';
import { db, auth } from '../config/firebase';
import GiftModal from '../components/GiftModal';
import GamesHubModal from '../components/GamesHubModal';
import DiceGame from '../components/games/DiceGame';
import CardGame from '../components/games/CardGame';
import CarGame from '../components/games/CarGame';
import LudoGame from '../components/games/LudoGame';
import LottieView from 'lottie-react-native';

const ChatMessage = memo(({ msg, isMe }) => (
  <Animated.View 
    entering={FadeInDown.duration(300).springify()} 
    style={[styles.chatMessage, isMe && styles.myChatMessage]}
  >
    <Text style={styles.chatText}>
      <Text style={[
        styles.chatUser, 
        msg.isSystem && { color: '#FFD700' },
        isMe && { color: '#FF9A9E' }
      ]}>
        {msg.user}: 
      </Text>
      {' '}{msg.text}
    </Text>
  </Animated.View>
));

const Seat = memo(({ seat, index, isMe, onTakeSeat }) => (
  <TouchableOpacity 
    style={styles.seatWrapper}
    onPress={() => onTakeSeat(index)}
    activeOpacity={0.7}
  >
    <Animated.View 
      entering={seat.isEmpty ? FadeIn : BounceIn.duration(500)}
      style={[styles.seat, seat.isEmpty && styles.emptySeat, isMe && styles.mySeat]}
    >
      {seat.isEmpty ? (
        <Ionicons name="add" size={20} color="rgba(255,255,255,0.5)" />
      ) : (
        <Ionicons name="person" size={24} color={isMe ? '#000' : '#fff'} />
      )}
    </Animated.View>
    <Text style={[styles.seatName, isMe && {color: '#FFD700', fontWeight: 'bold'}]} numberOfLines={1}>
      {seat.isEmpty ? 'Empty' : (isMe ? 'You' : seat.userName)}
    </Text>
  </TouchableOpacity>
));

export default function VoiceRoomScreen({ route, navigation }) {
  const { roomId, roomName = 'Live Room', host = 'Host' } = route.params || {};
  const user = auth.currentUser;
  
  const [isMuted, setIsMuted] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [seats, setSeats] = useState(Array.from({ length: 8 }).map((_, i) => ({ id: i.toString(), isEmpty: true, name: '' })));
  const [showGifts, setShowGifts] = useState(false);
  const [showGamesHub, setShowGamesHub] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [userCoins, setUserCoins] = useState(5000);
  const [activeAnimation, setActiveAnimation] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const userRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.coins !== undefined) {
          setUserCoins(data.coins);
        } else {
          // Initialize coins if user from before Phase 4
          setDoc(userRef, { coins: 5000, diamonds: 0 }, { merge: true });
          setUserCoins(5000);
        }
      } else {
        // Create user document if it completely doesn't exist
        setDoc(userRef, { 
          displayName: user?.displayName || 'Guest',
          coins: 5000, 
          diamonds: 0 
        }, { merge: true });
        setUserCoins(5000);
      }
    });
    return () => unsubUser();
  }, [user?.uid]);

  useEffect(() => {
    if (!roomId) return;

    const roomRef = doc(db, 'rooms', roomId);
    const unsubRoom = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.seats) setSeats(data.seats);
        if (data.gameState) setGameState(data.gameState);
        setIsJoined(true);
      } else {
        Alert.alert("Room Closed", "This room has ended.");
        navigation.goBack();
      }
    });

    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));
    const unsubChat = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })); 
      setMessages(msgs);

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const msgData = change.doc.data();
          if (msgData.isGift && msgData.animationUrl) {
            setActiveAnimation(msgData.animationUrl);
            setTimeout(() => setActiveAnimation(null), 3500);
          }
        }
      });
    });

    return () => {
      unsubRoom();
      unsubChat();
    };
  }, [roomId]);

  const renderMessage = useCallback(({ item }) => (
    <ChatMessage msg={item} isMe={item.userId === user?.uid} />
  ), [user?.uid]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const handleSendChat = useCallback(async () => {
    if (chatInput.trim().length > 0 && roomId) {
      try {
        await addDoc(collection(db, 'rooms', roomId, 'messages'), {
          user: user?.displayName || 'User',
          userId: user?.uid,
          text: chatInput.trim(),
          createdAt: serverTimestamp(),
          isSystem: false
        });
        setChatInput('');
      } catch (error) {
        console.error("Error sending message: ", error);
      }
    }
  }, [chatInput, roomId, user]);

  const handleSendGift = useCallback(async (gift) => {
    if (!roomId || userCoins < gift.cost) return;
    try {
      const newCoins = userCoins - gift.cost;
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { coins: newCoins }, { merge: true });
      
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        user: user?.displayName || 'User',
        userId: user?.uid,
        text: `Sent a ${gift.name} ${gift.icon}`,
        isGift: true,
        animationUrl: gift.animation,
        createdAt: serverTimestamp(),
        isSystem: false
      });
      setShowGifts(false);
    } catch (e) {
      console.error("Error sending gift:", e);
    }
  }, [roomId, user, userCoins]);

  const takeSeat = useCallback(async (index) => {
    if (!roomId) return;
    const roomRef = doc(db, 'rooms', roomId);
    const newSeats = [...seats];

    const userCurrentSeatIndex = newSeats.findIndex(s => s.userId === user?.uid);

    if (newSeats[index].isEmpty) {
      if (userCurrentSeatIndex !== -1) {
        newSeats[userCurrentSeatIndex] = { ...newSeats[userCurrentSeatIndex], isEmpty: true, userId: null, userName: '' };
      }
      newSeats[index] = { ...newSeats[index], isEmpty: false, userId: user?.uid, userName: user?.displayName || 'User' };
      
      try {
        await updateDoc(roomRef, { seats: newSeats });
        await addDoc(collection(db, 'rooms', roomId, 'messages'), {
          user: 'System',
          text: `${user?.displayName || 'A user'} took a seat!`,
          createdAt: serverTimestamp(),
          isSystem: true
        });
      } catch (e) {
        console.error("Error taking seat: ", e);
      }

    } else if (newSeats[index].userId === user?.uid) {
      newSeats[index] = { ...newSeats[index], isEmpty: true, userId: null, userName: '' };
      try {
        await updateDoc(roomRef, { seats: newSeats });
        await addDoc(collection(db, 'rooms', roomId, 'messages'), {
          user: 'System',
          text: `${user?.displayName || 'A user'} left their seat.`,
          createdAt: serverTimestamp(),
          isSystem: true
        });
      } catch (e) {
        console.error("Error leaving seat: ", e);
      }
    } else {
      Alert.alert("Seat Taken", "This seat is already occupied.");
    }
  }, [roomId, seats, user]);

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000&auto=format&fit=crop' }} 
      style={styles.backgroundImage}
      blurRadius={10}
    >
      <View style={styles.overlay} />
      
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.roomName}>{roomName}</Text>
          <Text style={styles.roomID}>{isJoined ? 'Live 🔴' : 'Connecting...'}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.hostContainer}>
        <View style={styles.hostAvatar}>
          <View style={styles.liveTag}><Text style={styles.liveText}>HOST</Text></View>
        </View>
        <Text style={styles.hostName}>{host}</Text>
      </Animated.View>

      <View style={styles.seatsContainer}>
        {seats.map((seat, index) => (
          <Seat 
            key={index} 
            index={index} 
            seat={seat} 
            isMe={seat.userId === user?.uid} 
            onTakeSeat={takeSeat} 
          />
        ))}
      </View>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        inverted
        style={styles.chatContainer}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      <GiftModal 
        visible={showGifts} 
        onClose={() => setShowGifts(false)} 
        onSendGift={handleSendGift} 
        userCoins={userCoins} 
      />

      <GamesHubModal 
        visible={showGamesHub} 
        onClose={() => setShowGamesHub(false)} 
        roomId={roomId}
        isHost={user?.displayName === host || host === 'Host'} 
      />

      {gameState?.activeGame === 'dice' && (
        <DiceGame 
          gameState={gameState} 
          roomId={roomId} 
          onClose={() => setGameState(null)} 
        />
      )}
      {gameState?.activeGame === 'cards' && (
        <CardGame 
          gameState={gameState} 
          roomId={roomId} 
          onClose={() => setGameState(null)} 
        />
      )}
      {gameState?.activeGame === 'car' && (
        <CarGame 
          gameState={gameState} 
          roomId={roomId} 
          onClose={() => setGameState(null)} 
          isHost={user?.displayName === host || host === 'Host'} 
        />
      )}
      {gameState?.activeGame === 'ludo' && (
        <LudoGame 
          gameState={gameState} 
          roomId={roomId} 
          onClose={() => setGameState(null)} 
          isHost={user?.displayName === host || host === 'Host'} 
        />
      )}

      {activeAnimation && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, justifyContent: 'center', alignItems: 'center' }]} pointerEvents="none">
          <LottieView
            source={{ uri: activeAnimation }}
            autoPlay
            loop={false}
            style={{ width: '100%', height: '100%' }}
            onAnimationFinish={() => setActiveAnimation(null)}
          />
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.bottomBar}>
          <View style={styles.chatInputContainer}>
            <TextInput 
              style={styles.chatInputText}
              placeholder="Say something..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={handleSendChat}
              returnKeyType="send"
            />
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.circleBtn, isMuted ? { backgroundColor: 'rgba(255,0,0,0.5)' } : {}]} 
              onPress={toggleMute}
            >
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.circleBtn, { backgroundColor: '#4CAF50', shadowColor: '#4CAF50', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }]}
              onPress={() => setShowGamesHub(true)}
            >
              <Ionicons name="game-controller" size={22} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.circleBtn, { backgroundColor: '#FF3B8B', shadowColor: '#FF3B8B', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }]}
              onPress={() => setShowGifts(true)}
            >
              <Ionicons name="gift" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 15 },
  iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 22, backdropFilter: 'blur(10px)' },
  headerTitleContainer: { alignItems: 'center' },
  roomName: { color: '#fff', fontSize: 18, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  roomID: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  hostContainer: { alignItems: 'center', marginTop: 25, marginBottom: 35 },
  hostAvatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 3, borderColor: '#FF3B8B', justifyContent: 'center', alignItems: 'center', shadowColor: '#FF3B8B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  liveTag: { position: 'absolute', bottom: -8, backgroundColor: '#FF3B8B', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 2, borderColor: '#000' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  hostName: { color: '#fff', marginTop: 12, fontWeight: '700', fontSize: 15, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  seatsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 20 },
  seatWrapper: { width: '25%', alignItems: 'center', marginBottom: 25 },
  seat: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  emptySeat: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', borderStyle: 'dashed', backgroundColor: 'transparent', shadowOpacity: 0 },
  mySeat: { backgroundColor: '#FFD700', borderColor: '#FFA500', borderWidth: 2, shadowColor: '#FFD700', shadowOpacity: 0.4, shadowRadius: 8 },
  seatName: { color: '#fff', fontSize: 11, marginTop: 6, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  chatContainer: { flex: 1, paddingHorizontal: 15, marginTop: 10, marginBottom: 10 },
  chatMessage: { backgroundColor: 'rgba(0,0,0,0.4)', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, marginBottom: 10, backdropFilter: 'blur(5px)', maxWidth: '85%' },
  myChatMessage: { backgroundColor: 'rgba(255,59,139,0.25)', borderWidth: 1, borderColor: 'rgba(255,59,139,0.3)' },
  chatText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  chatUser: { color: '#84fab0', fontWeight: 'bold' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: Platform.OS === 'ios' ? 35 : 20, paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  chatInputContainer: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', height: 44, borderRadius: 22, justifyContent: 'center', paddingHorizontal: 18, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chatInputText: { color: '#fff', height: '100%', fontSize: 15 },
  actionButtons: { flexDirection: 'row' },
  circleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginLeft: 10, backdropFilter: 'blur(5px)' }
});
