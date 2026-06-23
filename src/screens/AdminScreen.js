import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Platform
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  collection, onSnapshot, doc, updateDoc, query,
  orderBy, getDocs, getDoc, where, addDoc, serverTimestamp, increment
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { ROLES, beansToUSD, PLATFORM_CUT, AGENCY_CUT } from '../utils/economy';

const ROLE_COLORS = {
  admin:       '#FF3B8B',
  host:        '#a78bfa',
  coin_seller: '#FCD34D',
  agency:      '#34D399',
  user:        '#60A5FA',
};

const ROLE_ICONS = {
  admin:       'shield-checkmark',
  host:        'mic',
  coin_seller: 'cash',
  agency:      'briefcase',
  user:        'person',
};

export default function AdminScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers]         = useState([]);
  const [payouts, setPayouts]     = useState([]);
  const [stats, setStats]         = useState({ totalUsers: 0, totalRevenue: 0, pendingPayouts: 0, totalGifts: 0 });
  const [loading, setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Verify admin
  const currentUser = auth.currentUser;

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(list);
      const rev = list.reduce((sum, u) => sum + (u.platformRevenue || 0), 0);
      setStats(prev => ({ ...prev, totalUsers: list.length, totalRevenue: rev }));
      setLoading(false);
    });

    const unsubPayouts = onSnapshot(
      query(collection(db, 'payoutRequests'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPayouts(list);
        setStats(prev => ({
          ...prev,
          pendingPayouts: list.filter(p => p.status === 'pending').length
        }));
      }
    );

    return () => { unsubUsers(); unsubPayouts(); };
  }, []);

  const changeRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      Alert.alert('✅ Role Updated', `User role changed to ${newRole}`);
      setSelectedUser(null);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const approvePayout = async (payout) => {
    try {
      await updateDoc(doc(db, 'payoutRequests', payout.id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: currentUser?.uid,
      });
      await updateDoc(doc(db, 'users', payout.hostId), {
        beans: 0,
        totalEarned: increment(payout.hostAmount),
      });
      await updateDoc(doc(db, 'platform', 'revenue'), {
        total: increment(payout.platformAmount),
      }).catch(() =>
        addDoc(collection(db, 'platform'), { id: 'revenue', total: payout.platformAmount })
      );
      Alert.alert('✅ Approved', `Payout of ${beansToUSD(payout.hostAmount)} approved!`);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const rejectPayout = async (payoutId) => {
    await updateDoc(doc(db, 'payoutRequests', payoutId), {
      status: 'rejected',
      rejectedAt: serverTimestamp(),
    });
    Alert.alert('Rejected', 'Payout request rejected.');
  };

  const filteredUsers = users.filter(u =>
    (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPlatformRevenue = payouts
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + (p.platformAmount || 0), 0);

  const totalAgencyCommission = payouts
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + (p.agencyAmount || 0), 0);

  const totalHostPayout = payouts
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + (p.hostAmount || 0), 0);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF3B8B" />
        <Text style={{ color: '#888', marginTop: 10 }}>Loading admin data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>⚡ Admin Panel</Text>
          <Text style={styles.headerSub}>Full platform control</Text>
        </View>
        <View style={styles.adminBadge}>
          <Ionicons name="shield-checkmark" size={14} color="#FF3B8B" />
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['overview', 'users', 'payouts'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'overview' ? '📊 Overview' : tab === 'users' ? '👥 Users' : '💰 Payouts'}
              {tab === 'payouts' && stats.pendingPayouts > 0 && (
                <Text style={styles.badge}> {stats.pendingPayouts}</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <Animated.View entering={FadeInUp.duration(400)}>
            <View style={styles.statsGrid}>
              <StatCard icon="people" label="Total Users" value={stats.totalUsers} color="#60A5FA" />
              <StatCard icon="trending-up" label="Platform Revenue" value={beansToUSD(totalPlatformRevenue)} color="#FF3B8B" />
              <StatCard icon="briefcase" label="Agency Commission" value={beansToUSD(totalAgencyCommission)} color="#34D399" />
              <StatCard icon="wallet" label="Host Payouts" value={beansToUSD(totalHostPayout)} color="#a78bfa" />
            </View>

            {/* Revenue Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>💹 Revenue Breakdown</Text>
              <RevenueBar
                label="Platform (30%)"
                amount={totalPlatformRevenue}
                total={totalPlatformRevenue + totalAgencyCommission + totalHostPayout}
                color="#FF3B8B"
              />
              <RevenueBar
                label="Agency (20%)"
                amount={totalAgencyCommission}
                total={totalPlatformRevenue + totalAgencyCommission + totalHostPayout}
                color="#34D399"
              />
              <RevenueBar
                label="Host Payouts"
                amount={totalHostPayout}
                total={totalPlatformRevenue + totalAgencyCommission + totalHostPayout}
                color="#a78bfa"
              />
            </View>

            {/* Role Distribution */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>👥 Role Distribution</Text>
              {Object.values(ROLES).map(role => {
                const count = users.filter(u => (u.role || 'user') === role).length;
                return (
                  <View key={role} style={styles.roleRow}>
                    <View style={[styles.roleIcon, { backgroundColor: ROLE_COLORS[role] + '20' }]}>
                      <Ionicons name={ROLE_ICONS[role]} size={14} color={ROLE_COLORS[role]} />
                    </View>
                    <Text style={styles.roleName}>{role.replace('_', ' ')}</Text>
                    <Text style={[styles.roleCount, { color: ROLE_COLORS[role] }]}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <Animated.View entering={FadeInUp.duration(400)}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color="#888" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users..."
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            {filteredUsers.map((user, i) => (
              <Animated.View key={user.id} entering={FadeInDown.delay(i * 40).duration(300)}>
                <TouchableOpacity
                  style={styles.userCard}
                  onPress={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                >
                  <View style={styles.userAvatar}>
                    <Text style={{ fontSize: 22 }}>{user.avatar || '😊'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{user.displayName || 'Anonymous'}</Text>
                    <Text style={styles.userEmail} numberOfLines={1}>{user.email || 'No email'}</Text>
                  </View>
                  <View style={[styles.rolePill, { backgroundColor: ROLE_COLORS[user.role || 'user'] + '25' }]}>
                    <Text style={[styles.rolePillText, { color: ROLE_COLORS[user.role || 'user'] }]}>
                      {(user.role || 'user').replace('_', ' ')}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Role Change Drawer */}
                {selectedUser?.id === user.id && (
                  <Animated.View entering={FadeInDown.duration(200)} style={styles.roleDrawer}>
                    <Text style={styles.roleDrawerTitle}>Change Role:</Text>
                    <View style={styles.roleButtons}>
                      {Object.values(ROLES).map(role => (
                        <TouchableOpacity
                          key={role}
                          style={[styles.roleBtn, { borderColor: ROLE_COLORS[role] }]}
                          onPress={() => changeRole(user.id, role)}
                        >
                          <Ionicons name={ROLE_ICONS[role]} size={12} color={ROLE_COLORS[role]} />
                          <Text style={[styles.roleBtnText, { color: ROLE_COLORS[role] }]}>
                            {role.replace('_', ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.userStats}>
                      <Text style={styles.userStatItem}>🪙 {user.coins || 0} Coins</Text>
                      <Text style={styles.userStatItem}>🫘 {user.beans || 0} Beans</Text>
                      <Text style={styles.userStatItem}>💎 {user.diamonds || 0} Diamonds</Text>
                    </View>
                  </Animated.View>
                )}
              </Animated.View>
            ))}
          </Animated.View>
        )}

        {/* PAYOUTS TAB */}
        {activeTab === 'payouts' && (
          <Animated.View entering={FadeInUp.duration(400)}>
            {payouts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={48} color="#333" />
                <Text style={styles.emptyText}>No payout requests yet</Text>
              </View>
            ) : (
              payouts.map((payout, i) => (
                <Animated.View key={payout.id} entering={FadeInDown.delay(i * 50).duration(300)}>
                  <View style={[styles.payoutCard, payout.status !== 'pending' && { opacity: 0.6 }]}>
                    <View style={styles.payoutHeader}>
                      <Text style={styles.payoutHost}>{payout.hostName || 'Host'}</Text>
                      <View style={[styles.statusBadge, {
                        backgroundColor:
                          payout.status === 'approved' ? '#34D39920' :
                          payout.status === 'rejected' ? '#FF3B3B20' : '#FCD34D20'
                      }]}>
                        <Text style={[styles.statusText, {
                          color:
                            payout.status === 'approved' ? '#34D399' :
                            payout.status === 'rejected' ? '#FF3B3B' : '#FCD34D'
                        }]}>
                          {payout.status?.toUpperCase() || 'PENDING'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.payoutSplit}>
                      <SplitRow label="Total Beans" value={`🫘 ${payout.totalBeans || 0}`} color="#fff" />
                      <SplitRow label="Host Gets" value={beansToUSD(payout.hostAmount || 0)} color="#a78bfa" />
                      <SplitRow label="Agency Cut" value={beansToUSD(payout.agencyAmount || 0)} color="#34D399" />
                      <SplitRow label="Platform Rev" value={beansToUSD(payout.platformAmount || 0)} color="#FF3B8B" />
                    </View>

                    {payout.status === 'pending' && (
                      <View style={styles.payoutActions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#34D39920', borderColor: '#34D399' }]}
                          onPress={() => approvePayout(payout)}
                        >
                          <Ionicons name="checkmark" size={14} color="#34D399" />
                          <Text style={[styles.actionBtnText, { color: '#34D399' }]}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: '#FF3B3B20', borderColor: '#FF3B3B' }]}
                          onPress={() => rejectPayout(payout.id)}
                        >
                          <Ionicons name="close" size={14} color="#FF3B3B" />
                          <Text style={[styles.actionBtnText, { color: '#FF3B3B' }]}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </Animated.View>
              ))
            )}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '40' }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RevenueBar({ label, amount, total, color }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: '#aaa', fontSize: 13 }}>{label}</Text>
        <Text style={{ color, fontSize: 13, fontWeight: 'bold' }}>{beansToUSD(amount)}</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function SplitRow({ label, value, color }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ color: '#888', fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontSize: 12, fontWeight: 'bold' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#0D0D0D' },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 55 : 24 },
  headerTitle:       { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSub:         { color: '#666', fontSize: 13, marginTop: 2 },
  adminBadge:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3B8B20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#FF3B8B40' },
  adminBadgeText:    { color: '#FF3B8B', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  tabs:              { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tab:               { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab:         { borderBottomWidth: 2, borderBottomColor: '#FF3B8B' },
  tabText:           { color: '#666', fontSize: 13, fontWeight: '600' },
  activeTabText:     { color: '#FF3B8B' },
  badge:             { backgroundColor: '#FF3B8B', color: '#fff', borderRadius: 8, paddingHorizontal: 5 },
  statsGrid:         { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  statCard:          { width: '47%', backgroundColor: '#141414', borderRadius: 16, padding: 16, margin: 4, borderWidth: 1, alignItems: 'center' },
  statIconWrap:      { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue:         { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  statLabel:         { color: '#666', fontSize: 11 },
  card:              { backgroundColor: '#141414', borderRadius: 18, margin: 12, marginTop: 0, padding: 18, borderWidth: 1, borderColor: '#1f1f1f' },
  cardTitle:         { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  roleRow:           { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  roleIcon:          { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  roleName:          { flex: 1, color: '#ccc', fontSize: 14, textTransform: 'capitalize' },
  roleCount:         { fontSize: 16, fontWeight: 'bold' },
  searchContainer:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', margin: 12, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  searchInput:       { flex: 1, color: '#fff', fontSize: 14 },
  userCard:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', marginHorizontal: 12, marginBottom: 4, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1f1f1f' },
  userAvatar:        { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1f1f1f', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userName:          { color: '#fff', fontSize: 14, fontWeight: '600' },
  userEmail:         { color: '#666', fontSize: 12, marginTop: 2 },
  rolePill:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  rolePillText:      { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  roleDrawer:        { backgroundColor: '#1a1a1a', marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#252525' },
  roleDrawerTitle:   { color: '#888', fontSize: 12, marginBottom: 10 },
  roleButtons:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  roleBtn:           { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  roleBtnText:       { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  userStats:         { flexDirection: 'row', gap: 12 },
  userStatItem:      { color: '#888', fontSize: 12 },
  payoutCard:        { backgroundColor: '#141414', marginHorizontal: 12, marginBottom: 10, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1f1f1f' },
  payoutHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  payoutHost:        { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusBadge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText:        { fontSize: 11, fontWeight: '800' },
  payoutSplit:       { backgroundColor: '#0f0f0f', borderRadius: 10, padding: 12, marginBottom: 12 },
  payoutActions:     { flexDirection: 'row', gap: 10 },
  actionBtn:         { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  actionBtnText:     { fontSize: 13, fontWeight: '700' },
  emptyState:        { alignItems: 'center', paddingTop: 60 },
  emptyText:         { color: '#444', fontSize: 16, marginTop: 12 },
  barBg:             { height: 6, backgroundColor: '#1f1f1f', borderRadius: 3, overflow: 'hidden' },
  barFill:           { height: '100%', borderRadius: 3 },
});
