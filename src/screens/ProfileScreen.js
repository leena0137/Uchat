import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ScrollView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { db, auth } from '../config/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { beansToUSD } from '../utils/economy';

const AVATARS = ['😊', '😎', '🦊', '🐱', '🐼', '🦄', '👻', '🤖'];

const ROLE_CONFIG = {
  admin:       { label: 'Admin',       color: '#FF3B8B', icon: 'shield-checkmark', bg: '#FF3B8B20' },
  host:        { label: 'Host',        color: '#a78bfa', icon: 'mic',              bg: '#a78bfa20' },
  coin_seller: { label: 'Coin Seller', color: '#FCD34D', icon: 'cash',             bg: '#FCD34D20' },
  agency:      { label: 'Agency',      color: '#34D399', icon: 'briefcase',        bg: '#34D39920' },
  user:        { label: 'User',        color: '#60A5FA', icon: 'person',           bg: '#60A5FA20' },
};

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData]   = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio]             = useState('');
  const [avatar, setAvatar]       = useState('😊');

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      const docRef  = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.coins === undefined) {
          await setDoc(docRef, { coins: 5000, diamonds: 0, beans: 0 }, { merge: true });
          data.coins = 5000; data.diamonds = 0; data.beans = 0;
        }
        setUserData(data);
        setDisplayName(data.displayName || 'Anonymous');
        setBio(data.bio || 'No bio yet.');
        setAvatar(data.avatar || '😊');
      } else {
        const newData = {
          displayName: user.displayName || 'Guest',
          bio:         'No bio yet.',
          avatar:      '😊',
          coins:       5000,
          diamonds:    0,
          beans:       0,
          role:        'user',
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
      await updateDoc(doc(db, 'users', user.uid), { displayName, bio, avatar });
      setIsEditing(false);
      fetchProfile();
      Alert.alert('✅ Saved', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      Alert.alert('Error', 'Could not sign out. Please try again.');
    }
  };

  const handleBecomeAdmin = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
      fetchProfile();
      Alert.alert('✅ Admin Access Granted', 'You are now an Admin! You can see the Moderation Panel.');
    } catch (e) {
      Alert.alert('Error', 'Failed to upgrade role.');
    }
  };

  if (!userData) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16 }}>Loading...</Text>
        </View>
      </View>
    );
  }

  const role       = userData.role || 'user';
  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.user;
  const beans      = userData.beans || 0;
  const coins      = userData.coins || 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={() => isEditing ? handleSave() : setIsEditing(true)}>
            <Text style={styles.editButton}>{isEditing ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#FF3B3B" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Avatar + Role Badge */}
      <Animated.View entering={ZoomIn.duration(500)} style={styles.profileSection}>
        {isEditing ? (
          <View style={styles.avatarGrid}>
            {AVATARS.map((emoji, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setAvatar(emoji)}
                style={[styles.avatarOption, avatar === emoji && styles.avatarSelected]}
              >
                <Text style={{ fontSize: 26 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={[styles.avatarCircle, { borderColor: roleConfig.color + '60' }]}>
            <Text style={{ fontSize: 52 }}>{avatar}</Text>
          </View>
        )}

        {isEditing ? (
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display Name"
            placeholderTextColor="#555"
          />
        ) : (
          <Text style={styles.name}>{displayName}</Text>
        )}

        {/* Role Badge */}
        <View style={[styles.roleBadge, { backgroundColor: roleConfig.bg, borderColor: roleConfig.color + '50' }]}>
          <Ionicons name={roleConfig.icon} size={13} color={roleConfig.color} />
          <Text style={[styles.roleText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
        </View>

        {isEditing ? (
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Write a bio..."
            placeholderTextColor="#555"
            multiline
          />
        ) : (
          <Text style={styles.bio}>{bio}</Text>
        )}
      </Animated.View>

      {/* Stats Row */}
      <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.statsRow}>
        <View style={[styles.statBox, { borderColor: '#FFD70030' }]}>
          <Text style={styles.statEmoji}>🪙</Text>
          <Text style={[styles.statValue, { color: '#FFD700' }]}>{coins.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Coins</Text>
        </View>
        {(role === 'host' || role === 'admin') && (
          <View style={[styles.statBox, { borderColor: '#a78bfa30' }]}>
            <Text style={styles.statEmoji}>🫘</Text>
            <Text style={[styles.statValue, { color: '#a78bfa' }]}>{beans.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Beans</Text>
          </View>
        )}
        <View style={[styles.statBox, { borderColor: '#00FFFF30' }]}>
          <Text style={styles.statEmoji}>💎</Text>
          <Text style={[styles.statValue, { color: '#00FFFF' }]}>{userData.diamonds || 0}</Text>
          <Text style={styles.statLabel}>Diamonds</Text>
        </View>
      </Animated.View>

      {/* Quick Access Section */}
      <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.quickSection}>
        <Text style={styles.sectionTitle}>Quick Access</Text>

        {/* Coin Shop — all users */}
        <QuickCard
          icon="cart-outline"
          iconColor="#FFD700"
          bg="#FFD70015"
          title="Coin Shop"
          subtitle="Buy coins to send gifts"
          onPress={() => navigation.navigate('CoinShop')}
        />

        {/* Beans Wallet — hosts & admins */}
        {(role === 'host' || role === 'admin') && (
          <QuickCard
            icon="wallet-outline"
            iconColor="#a78bfa"
            bg="#a78bfa15"
            title="Beans Wallet"
            subtitle={`${beans} beans · ${beansToUSD(beans)} est. value`}
            onPress={() => navigation.navigate('BeansWallet')}
            badge={beans >= 100 ? 'Cash Out' : null}
          />
        )}

        {/* Agency Hub — agencies */}
        {(role === 'agency' || role === 'admin') && (
          <QuickCard
            icon="briefcase-outline"
            iconColor="#34D399"
            bg="#34D39915"
            title="Agency Hub"
            subtitle="Manage your hosts & earnings"
            onPress={() => navigation.navigate('AgencyScreen')}
          />
        )}

        {/* Admin Panel — admins only */}
        {role === 'admin' ? (
          <>
            <QuickCard
              icon="shield-checkmark-outline"
              iconColor="#FF3B8B"
              bg="#FF3B8B15"
              title="Admin Panel"
              subtitle="Manage users, payouts & revenue"
              onPress={() => navigation.navigate('AdminScreen')}
              badge="Admin"
            />
            <QuickCard
              icon="eye-outline"
              iconColor="#34D399"
              bg="#34D39915"
              title="Moderation Panel"
              subtitle="Monitor rooms & live chat"
              onPress={() => navigation.navigate('ModerationScreen')}
              badge="Mod"
            />
          </>
        ) : (
          <QuickCard
            icon="star-outline"
            iconColor="#FFD700"
            bg="#FFD70015"
            title="Become Admin (Test)"
            subtitle="Instantly unlock Mod & Admin panels"
            onPress={handleBecomeAdmin}
            badge="Test"
          />
        )}
      </Animated.View>

      {/* Economy Flow Info */}
      <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.flowCard}>
        <Text style={styles.sectionTitle}>Platform Economy</Text>
        <View style={styles.flowRow}>
          <FlowStep icon="💰" label="Coin Sellers" />
          <Ionicons name="chevron-forward" size={14} color="#333" />
          <FlowStep icon="🪙" label="Users" />
          <Ionicons name="chevron-forward" size={14} color="#333" />
          <FlowStep icon="🎁" label="Gifts" />
          <Ionicons name="chevron-forward" size={14} color="#333" />
          <FlowStep icon="🎤" label="Hosts" />
          <Ionicons name="chevron-forward" size={14} color="#333" />
          <FlowStep icon="🫘" label="Beans" />
        </View>
        <View style={styles.splitRow}>
          <SplitChip pct="50-70%" label="Host" color="#a78bfa" />
          <SplitChip pct="0-20%" label="Agency" color="#34D399" />
          <SplitChip pct="30%" label="Platform" color="#FF3B8B" />
        </View>
      </Animated.View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

function QuickCard({ icon, iconColor, bg, title, subtitle, onPress, badge }) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.quickIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      {badge && (
        <View style={[styles.quickBadge, { backgroundColor: iconColor + '20', borderColor: iconColor + '50' }]}>
          <Text style={[styles.quickBadgeText, { color: iconColor }]}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color="#333" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

function FlowStep({ icon, label }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={{ color: '#555', fontSize: 9, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function SplitChip({ pct, label, color }) {
  return (
    <View style={[styles.splitChip, { borderColor: color + '40', backgroundColor: color + '10' }]}>
      <Text style={[styles.splitPct, { color }]}>{pct}</Text>
      <Text style={styles.splitLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0F1014' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 55 : 24 },
  headerTitle:    { color: '#fff', fontSize: 24, fontWeight: '800' },
  editButton:     { color: '#FF3B8B', fontSize: 15, fontWeight: '700' },
  profileSection: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  avatarCircle:   { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 2 },
  avatarGrid:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 },
  avatarOption:   { width: 52, height: 52, margin: 5, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center' },
  avatarSelected: { backgroundColor: 'rgba(255,64,129,0.2)', borderColor: '#FF4081', borderWidth: 2 },
  name:           { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 10 },
  roleBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  roleText:       { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  bio:            { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  input:          { backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', width: '100%', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#222', fontSize: 14 },
  statsRow:       { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  statBox:        { flex: 1, backgroundColor: '#141414', borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 1 },
  statEmoji:      { fontSize: 24, marginBottom: 6 },
  statValue:      { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  statLabel:      { color: '#555', fontSize: 11, fontWeight: '600' },
  quickSection:   { padding: 16, paddingTop: 8 },
  sectionTitle:   { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  quickCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1f1f1f' },
  quickIcon:      { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  quickTitle:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  quickSubtitle:  { color: '#666', fontSize: 12, marginTop: 2 },
  quickBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  quickBadgeText: { fontSize: 10, fontWeight: '800' },
  flowCard:       { backgroundColor: '#141414', marginHorizontal: 16, marginBottom: 8, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#1f1f1f' },
  flowRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  splitRow:       { flexDirection: 'row', gap: 8 },
  splitChip:      { flex: 1, alignItems: 'center', padding: 8, borderRadius: 10, borderWidth: 1 },
  splitPct:       { fontSize: 16, fontWeight: '900' },
  splitLabel:     { color: '#555', fontSize: 10, marginTop: 2 },
});
