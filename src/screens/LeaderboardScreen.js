import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Image, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { db, auth } from '../config/firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc } from 'firebase/firestore';

export default function LeaderboardScreen({ navigation }) {
  const [topUsers, setTopUsers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [isLive, setIsLive]     = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('diamonds', 'desc'), limit(50));

    const unsub = onSnapshot(q, (snapshot) => {
      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });

      if (users.length <= 1) {
        seedDummyUsers();
        return;
      }

      setTopUsers(users);
      setLoading(false);
      setIsLive(true);
    }, (error) => {
      console.error('Leaderboard error:', error);
      setLoading(false);
    });

    return () => unsub(); // Cleanup on unmount
  }, []);

  const seedDummyUsers = async () => {
    try {
      const dummyUsers = [
        { displayName: 'Alex', avatar: '😎', diamonds: 1500, coins: 500 },
        { displayName: 'Sam', avatar: '🦊', diamonds: 1200, coins: 400 },
        { displayName: 'Jordan', avatar: '🦄', diamonds: 900, coins: 300 },
        { displayName: 'Taylor', avatar: '🐼', diamonds: 850, coins: 200 },
        { displayName: 'Casey', avatar: '🤖', diamonds: 700, coins: 150 },
        { displayName: 'Riley', avatar: '🐱', diamonds: 600, coins: 100 },
        { displayName: 'Morgan', avatar: '👻', diamonds: 550, coins: 50 },
        { displayName: 'Jamie', avatar: '😊', diamonds: 400, coins: 40 },
        { displayName: 'Drew', avatar: '😎', diamonds: 350, coins: 30 },
        { displayName: 'Skyler', avatar: '🦊', diamonds: 200, coins: 20 },
      ];
      
      const usersRef = collection(db, 'users');
      for (const u of dummyUsers) {
        await addDoc(usersRef, u);
      }
      fetchLeaderboard();
    } catch(e) {
      console.error(e);
      Alert.alert("Error", "Could not add users");
    }
  };

  const openChat = (otherUser) => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "You must be logged in to send a message.");
      return;
    }
    if (user.uid === otherUser.id) {
      Alert.alert("Hey!", "You can't message yourself.");
      return;
    }
    const chatId = [user.uid, otherUser.id].sort().join('_');
    navigation.navigate('ChatScreen', { chatId, otherUserId: otherUser.id });
  };

  const renderTopThree = () => {
    if (topUsers.length < 3) return null;
    
    return (
      <View style={styles.topThreeContainer}>
        {/* Second Place */}
        <TouchableOpacity style={[styles.podiumItem, { marginTop: 40 }]} onPress={() => openChat(topUsers[1])}>
          <Text style={styles.crown}>🥈</Text>
          <View style={[styles.podiumAvatar, { borderColor: '#C0C0C0' }]}>
            <Text style={{fontSize: 30}}>{topUsers[1].avatar || '😊'}</Text>
          </View>
          <Text style={styles.podiumName} numberOfLines={1}>{topUsers[1].displayName || 'User'}</Text>
          <View style={styles.diamondBadge}>
            <Ionicons name="diamond" size={12} color="#00FFFF" />
            <Text style={styles.diamondText}>{topUsers[1].diamonds || 0}</Text>
          </View>
        </TouchableOpacity>

        {/* First Place */}
        <TouchableOpacity style={styles.podiumItem} onPress={() => openChat(topUsers[0])}>
          <Text style={styles.crown}>👑</Text>
          <View style={[styles.podiumAvatar, { borderColor: '#FFD700', width: 90, height: 90, borderRadius: 45 }]}>
            <Text style={{fontSize: 40}}>{topUsers[0].avatar || '😊'}</Text>
          </View>
          <Text style={styles.podiumName} numberOfLines={1}>{topUsers[0].displayName || 'User'}</Text>
          <View style={styles.diamondBadge}>
            <Ionicons name="diamond" size={12} color="#00FFFF" />
            <Text style={styles.diamondText}>{topUsers[0].diamonds || 0}</Text>
          </View>
        </TouchableOpacity>

        {/* Third Place */}
        <TouchableOpacity style={[styles.podiumItem, { marginTop: 60 }]} onPress={() => openChat(topUsers[2])}>
          <Text style={styles.crown}>🥉</Text>
          <View style={[styles.podiumAvatar, { borderColor: '#CD7F32' }]}>
            <Text style={{fontSize: 30}}>{topUsers[2].avatar || '😊'}</Text>
          </View>
          <Text style={styles.podiumName} numberOfLines={1}>{topUsers[2].displayName || 'User'}</Text>
          <View style={styles.diamondBadge}>
            <Ionicons name="diamond" size={12} color="#00FFFF" />
            <Text style={styles.diamondText}>{topUsers[2].diamonds || 0}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    if (index < 3) return null; // Skip top 3
    return (
      <TouchableOpacity style={styles.listItem} onPress={() => openChat(item)}>
        <Text style={styles.rank}>{index + 1}</Text>
        <View style={styles.listAvatar}>
          <Text style={{fontSize: 20}}>{item.avatar || '😊'}</Text>
        </View>
        <View style={styles.listInfo}>
          <Text style={styles.listName}>{item.displayName || 'Anonymous'}</Text>
        </View>
        <View style={styles.diamondBadge}>
          <Ionicons name="diamond" size={14} color="#00FFFF" />
          <Text style={[styles.diamondText, { fontSize: 14 }]}>{item.diamonds || 0}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={styles.container}><Text style={{color:'#fff', textAlign:'center', marginTop: 50}}>Loading Leaderboard...</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        <View style={{width: 24}} />
      </View>

      <FlatList
        data={topUsers}
        ListHeaderComponent={renderTopThree}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
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
  topThreeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingVertical: 30,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  crown: {
    fontSize: 24,
    marginBottom: -10,
    zIndex: 1,
  },
  podiumAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10,
  },
  podiumName: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 5,
    fontSize: 12,
  },
  diamondBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  diamondText: {
    color: '#00FFFF',
    fontWeight: 'bold',
    marginLeft: 4,
    fontSize: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 15,
    borderRadius: 15,
  },
  rank: {
    color: '#888',
    fontSize: 16,
    fontWeight: 'bold',
    width: 30,
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 139, 0.2)',
    borderWidth: 1,
    borderColor: '#FF3B8B',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B8B',
  },
  liveText: {
    color: '#FF3B8B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
