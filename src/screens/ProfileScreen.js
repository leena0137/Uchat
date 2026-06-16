import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../config/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

const AVATARS = ['😊', '😎', '🦊', '🐱', '🐼', '🦄', '👻', '🤖'];

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('😊');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Initialize coins if missing
        if (data.coins === undefined) {
          await setDoc(docRef, { coins: 5000, diamonds: 0 }, { merge: true });
          data.coins = 5000;
          data.diamonds = 0;
        }

        setUserData(data);
        setDisplayName(data.displayName || 'Anonymous');
        setBio(data.bio || 'No bio yet.');
        setAvatar(data.avatar || '😊');
      } else {
        // Document missing entirely
        const newData = {
          displayName: user.displayName || 'Guest',
          bio: 'No bio yet.',
          avatar: '😊',
          coins: 5000,
          diamonds: 0
        };
        await setDoc(docRef, newData);
        setUserData(newData);
        setDisplayName(newData.displayName);
        setBio(newData.bio);
        setAvatar(newData.avatar);
      }
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        bio,
        avatar
      });
      setIsEditing(false);
      fetchProfile();
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  if (!userData) return <View style={styles.container}><Text style={{color:'#fff'}}>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity onPress={() => isEditing ? handleSave() : setIsEditing(true)}>
          <Text style={styles.editButton}>{isEditing ? 'Save' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        {isEditing ? (
          <View style={styles.avatarGrid}>
            {AVATARS.map((emoji, index) => (
              <TouchableOpacity key={index} onPress={() => setAvatar(emoji)} style={[styles.avatarOption, avatar === emoji && styles.avatarSelected]}>
                <Text style={{fontSize: 24}}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={{fontSize: 50}}>{avatar}</Text>
          </View>
        )}
        
        {isEditing ? (
          <TextInput 
            style={styles.input} 
            value={displayName} 
            onChangeText={setDisplayName} 
            placeholder="Display Name"
            placeholderTextColor="#888"
          />
        ) : (
          <Text style={styles.name}>{displayName}</Text>
        )}

        {isEditing ? (
          <TextInput 
            style={[styles.input, {height: 80}]} 
            value={bio} 
            onChangeText={setBio} 
            placeholder="Write a bio..."
            placeholderTextColor="#888"
            multiline
          />
        ) : (
          <Text style={styles.bio}>{bio}</Text>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Ionicons name="wallet" size={32} color="#FFD700" />
          <Text style={styles.statValue}>{userData.coins || 0}</Text>
          <Text style={styles.statLabel}>Coins</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="diamond" size={32} color="#00FFFF" />
          <Text style={styles.statValue}>{userData.diamonds || 0}</Text>
          <Text style={styles.statLabel}>Diamonds</Text>
        </View>
      </View>
    </ScrollView>
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
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  editButton: {
    color: '#FF4081',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarOption: {
    width: 50,
    height: 50,
    margin: 5,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSelected: {
    backgroundColor: 'rgba(255,64,129,0.3)',
    borderColor: '#FF4081',
    borderWidth: 2,
  },
  name: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  bio: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff',
    width: '100%',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  statBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    width: '45%',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 5,
  },
});
