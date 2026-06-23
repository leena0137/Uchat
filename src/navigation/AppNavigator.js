import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

import HomeScreen          from '../screens/HomeScreen';
import ProfileScreen       from '../screens/ProfileScreen';
import VoiceRoomScreen     from '../screens/VoiceRoomScreen';
import LoginScreen         from '../screens/LoginScreen';
import SignupScreen        from '../screens/SignupScreen';
import LeaderboardScreen   from '../screens/LeaderboardScreen';
import MessagesListScreen  from '../screens/MessagesListScreen';
import ChatScreen          from '../screens/ChatScreen';
import AdminScreen         from '../screens/AdminScreen';
import CoinShopScreen      from '../screens/CoinShopScreen';
import BeansWalletScreen   from '../screens/BeansWalletScreen';
import AgencyScreen        from '../screens/AgencyScreen';
import ModerationScreen    from '../screens/ModerationScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Tab navigators per role ──────────────────────────────────────────────────

function UserTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Home"        component={HomeScreen}         options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'home' : 'home-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen}  options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'trophy' : 'trophy-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Messages"    component={MessagesListScreen} options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'chatbubbles' : 'chatbubbles-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="CoinShop"    component={CoinShopScreen}     options={{ title: 'Shop', tabBarIcon: p => <Ionicons name={p.focused ? 'cart' : 'cart-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Profile"     component={ProfileScreen}      options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'person' : 'person-outline'} size={p.size} color={p.color} /> }} />
    </Tab.Navigator>
  );
}

function HostTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Home"        component={HomeScreen}         options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'home' : 'home-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen}  options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'trophy' : 'trophy-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Messages"    component={MessagesListScreen} options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'chatbubbles' : 'chatbubbles-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Wallet"      component={BeansWalletScreen}  options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'wallet' : 'wallet-outline'} size={p.size} color={p.color} />, tabBarActiveTintColor: '#a78bfa' }} />
      <Tab.Screen name="Profile"     component={ProfileScreen}      options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'person' : 'person-outline'} size={p.size} color={p.color} /> }} />
    </Tab.Navigator>
  );
}

function AgencyTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Home"        component={HomeScreen}         options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'home' : 'home-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Agency"      component={AgencyScreen}       options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'briefcase' : 'briefcase-outline'} size={p.size} color={p.color} />, tabBarActiveTintColor: '#34D399' }} />
      <Tab.Screen name="Messages"    component={MessagesListScreen} options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'chatbubbles' : 'chatbubbles-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen}  options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'trophy' : 'trophy-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Profile"     component={ProfileScreen}      options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'person' : 'person-outline'} size={p.size} color={p.color} /> }} />
    </Tab.Navigator>
  );
}

function CoinSellerTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Home"        component={HomeScreen}         options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'home' : 'home-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Shop"        component={CoinShopScreen}     options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'cash' : 'cash-outline'} size={p.size} color={p.color} />, tabBarActiveTintColor: '#FCD34D' }} />
      <Tab.Screen name="Messages"    component={MessagesListScreen} options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'chatbubbles' : 'chatbubbles-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen}  options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'trophy' : 'trophy-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Profile"     component={ProfileScreen}      options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'person' : 'person-outline'} size={p.size} color={p.color} /> }} />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={{ ...tabOptions, tabBarActiveTintColor: '#FF3B8B' }}>
      <Tab.Screen name="Home"        component={HomeScreen}         options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'home' : 'home-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Admin"       component={AdminScreen}        options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={p.size} color={p.color} />, tabBarActiveTintColor: '#FF3B8B' }} />
      <Tab.Screen name="Messages"    component={MessagesListScreen} options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'chatbubbles' : 'chatbubbles-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen}  options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'trophy' : 'trophy-outline'} size={p.size} color={p.color} /> }} />
      <Tab.Screen name="Profile"     component={ProfileScreen}      options={{ tabBarIcon: p => <Ionicons name={p.focused ? 'person' : 'person-outline'} size={p.size} color={p.color} /> }} />
    </Tab.Navigator>
  );
}

// Shared tab bar style
const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: '#FF3B8B',
  tabBarInactiveTintColor: '#555',
  tabBarStyle: {
    backgroundColor: '#111',
    borderTopWidth: 0,
    paddingBottom: 6,
    paddingTop: 4,
    height: 58,
  },
  tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
};

// ─── Role-Aware Main Navigator ────────────────────────────────────────────────

function RoleTabNavigator({ role }) {
  switch (role) {
    case 'admin':       return <AdminTabs />;
    case 'host':        return <HostTabs />;
    case 'agency':      return <AgencyTabs />;
    case 'coin_seller': return <CoinSellerTabs />;
    default:            return <UserTabs />;
  }
}

function AppStack({ role }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main">{() => <RoleTabNavigator role={role} />}</Stack.Screen>
      <Stack.Screen name="ChatScreen"     component={ChatScreen} />
      <Stack.Screen name="VoiceRoom"      component={VoiceRoomScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="CoinShop"       component={CoinShopScreen} />
      <Stack.Screen name="BeansWallet"    component={BeansWalletScreen} />
      <Stack.Screen name="AgencyScreen"   component={AgencyScreen} />
      <Stack.Screen name="AdminScreen"    component={AdminScreen} />
      <Stack.Screen name="ModerationScreen" component={ModerationScreen} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"  component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

// ─── Root Navigator ────────────────────────────────────────────────────────────

export default function AppNavigator() {
  const [user, setUser]   = useState(undefined); // undefined = loading
  const [role, setRole]   = useState('user');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsub;
  }, []);

  // Listen to role changes in Firestore in real-time
  useEffect(() => {
    if (!user?.uid) { setRole('user'); return; }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setRole(snap.data().role || 'user');
      }
    });
    return unsub;
  }, [user?.uid]);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FF3B8B" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppStack role={role} /> : <AuthStack />}
    </NavigationContainer>
  );
}
