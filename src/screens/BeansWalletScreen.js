import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import {
  doc, onSnapshot, addDoc, collection,
  serverTimestamp, query, orderBy, getDoc
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { calculatePayout, beansToUSD, PLATFORM_CUT, AGENCY_CUT } from '../utils/economy';

export default function BeansWalletScreen({ navigation }) {
  const [userData, setUserData]       = useState(null);
  const [payouts, setPayouts]         = useState([]);
  const [requesting, setRequesting]   = useState(false);
  const [activeTab, setActiveTab]     = useState('wallet');
  const user = auth.currentUser;

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      query(collection(db, 'payoutRequests'), orderBy('createdAt', 'desc')),
      (snap) => {
        const mine = snap.docs
          .filter(d => d.data().hostId === user.uid)
          .map(d => ({ id: d.id, ...d.data() }));
        setPayouts(mine);
      }
    );
    return unsub;
  }, [user?.uid]);

  const beans     = userData?.beans || 0;
  const agencyId  = userData?.agencyId || null;
  const { hostAmount, agencyAmount, platformAmount } = calculatePayout(beans, !!agencyId);

  const handleRequestPayout = async () => {
    if (beans < 100) {
      Alert.alert('Minimum Required', 'You need at least 100 beans to request a payout.');
      return;
    }

    Alert.alert(
      '💸 Request Payout',
      `You'll receive ${beansToUSD(hostAmount)} (${beans} beans).\n\nBreakdown:\n• Host: ${beansToUSD(hostAmount)}\n• Agency: ${beansToUSD(agencyAmount)}\n• Platform: ${beansToUSD(platformAmount)}\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: async () => {
            setRequesting(true);
            try {
              await addDoc(collection(db, 'payoutRequests'), {
                hostId:         user.uid,
                hostName:       user.displayName || userData?.displayName || 'Host',
                totalBeans:     beans,
                hostAmount,
                agencyAmount,
                platformAmount,
                agencyId:       agencyId || null,
                status:         'pending',
                createdAt:      serverTimestamp(),
              });
              Alert.alert('✅ Submitted!', 'Your payout request has been sent to admin for approval.');
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setRequesting(false);
            }
          }
        }
      ]
    );
  };

  if (!userData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  const totalEarned  = userData.totalEarned || 0;
  const hasPending   = payouts.some(p => p.status === 'pending');

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Beans Wallet</Text>
          <Text style={styles.headerSub}>Your host earnings</Text>
        </View>
        <View style={styles.hostBadge}>
          <Ionicons name="mic" size={12} color="#a78bfa" />
          <Text style={styles.hostBadgeText}>HOST</Text>
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['wallet', 'history'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'wallet' ? '🫘 Wallet' : '📜 Payouts'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {activeTab === 'wallet' && (
          <>
            {/* Main Balance Card */}
            <Animated.View entering={ZoomIn.duration(500)} style={styles.beansCard}>
              <View style={styles.beansGlow} />
              <Text style={styles.beansLabel}>Current Beans</Text>
              <Text style={styles.beansAmount}>🫘 {beans.toLocaleString()}</Text>
              <Text style={styles.beansUSD}>{beansToUSD(beans)} estimated value</Text>

              {/* Payout Split Preview */}
              <View style={styles.splitBox}>
                <SplitItem
                  label="You receive"
                  value={beansToUSD(hostAmount)}
                  percent={agencyId ? '50%' : '70%'}
                  color="#a78bfa"
                  icon="💸"
                />
                {agencyId && (
                  <SplitItem
                    label="Agency"
                    value={beansToUSD(agencyAmount)}
                    percent="20%"
                    color="#34D399"
                    icon="🏢"
                  />
                )}
                <SplitItem
                  label="Platform"
                  value={beansToUSD(platformAmount)}
                  percent="30%"
                  color="#FF3B8B"
                  icon="⚡"
                />
              </View>

              <TouchableOpacity
                style={[styles.payoutBtn, (hasPending || beans < 100) && { opacity: 0.5 }]}
                onPress={handleRequestPayout}
                disabled={hasPending || beans < 100 || requesting}
              >
                {requesting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cash-outline" size={18} color="#fff" />
                    <Text style={styles.payoutBtnText}>
                      {hasPending ? 'Payout Pending...' : 'Request Payout'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {beans < 100 && !hasPending && (
                <Text style={styles.minHint}>Minimum 100 beans needed for payout</Text>
              )}
            </Animated.View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statBox}>
                <Text style={styles.statIcon}>🏆</Text>
                <Text style={styles.statValue}>{beansToUSD(totalEarned)}</Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.statBox}>
                <Text style={styles.statIcon}>🎁</Text>
                <Text style={styles.statValue}>{userData.totalGiftsReceived || 0}</Text>
                <Text style={styles.statLabel}>Gifts Received</Text>
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.statBox}>
                <Text style={styles.statIcon}>🏢</Text>
                <Text style={styles.statValue}>{agencyId ? 'Yes' : 'None'}</Text>
                <Text style={styles.statLabel}>Agency</Text>
              </Animated.View>
            </View>

            {/* How it works */}
            <View style={styles.howItWorksCard}>
              <Text style={styles.howTitle}>How Beans Work</Text>
              {[
                { icon: '🎁', text: 'Viewers send you gifts using their Coins' },
                { icon: '🫘', text: 'Each coin gift = 1 Bean added to your wallet' },
                { icon: '💸', text: 'Request payout when you have 100+ beans' },
                { icon: '✅', text: 'Admin approves and transfers your earnings' },
              ].map((item, i) => (
                <View key={i} style={styles.howRow}>
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  <Text style={styles.howText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'history' && (
          <Animated.View entering={FadeInUp.duration(400)}>
            {payouts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={48} color="#333" />
                <Text style={styles.emptyText}>No payout requests yet</Text>
                <Text style={styles.emptyHint}>Earn beans by hosting and request a payout!</Text>
              </View>
            ) : (
              payouts.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(i * 50).duration(300)}>
                  <View style={styles.payoutRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payoutBeans}>🫘 {p.totalBeans} beans</Text>
                      <Text style={styles.payoutUSD}>{beansToUSD(p.hostAmount)} to you</Text>
                      <Text style={styles.payoutDate}>
                        {p.createdAt?.toDate?.()?.toLocaleDateString() || 'Just now'}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, {
                      backgroundColor:
                        p.status === 'approved' ? '#34D39920' :
                        p.status === 'rejected' ? '#FF3B3B20' : '#FCD34D20'
                    }]}>
                      <Text style={[styles.statusText, {
                        color: p.status === 'approved' ? '#34D399' :
                               p.status === 'rejected' ? '#FF3B3B' : '#FCD34D'
                      }]}>
                        {(p.status || 'pending').toUpperCase()}
                      </Text>
                    </View>
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

function SplitItem({ label, value, percent, color, icon }) {
  return (
    <View style={styles.splitItem}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={{ color: '#888', fontSize: 11 }}>{label} ({percent})</Text>
        <Text style={[{ color, fontSize: 15, fontWeight: '700' }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0D0D0D' },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 55 : 24, paddingBottom: 16, gap: 12 },
  backBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  headerTitle:    { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub:      { color: '#666', fontSize: 12 },
  hostBadge:      { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', backgroundColor: '#a78bfa20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#a78bfa40', gap: 4 },
  hostBadgeText:  { color: '#a78bfa', fontSize: 11, fontWeight: '800' },
  tabs:           { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', marginBottom: 4 },
  tab:            { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab:      { borderBottomWidth: 2, borderBottomColor: '#a78bfa' },
  tabText:        { color: '#666', fontSize: 13, fontWeight: '600' },
  activeTabText:  { color: '#a78bfa' },
  beansCard:      { margin: 16, borderRadius: 24, backgroundColor: '#141414', padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#a78bfa30', overflow: 'hidden' },
  beansGlow:      { position: 'absolute', top: -50, width: 220, height: 120, borderRadius: 110, backgroundColor: '#a78bfa10' },
  beansLabel:     { color: '#888', fontSize: 13, marginBottom: 6 },
  beansAmount:    { color: '#a78bfa', fontSize: 42, fontWeight: '900', marginBottom: 4 },
  beansUSD:       { color: '#666', fontSize: 13, marginBottom: 20 },
  splitBox:       { width: '100%', backgroundColor: '#0f0f0f', borderRadius: 14, padding: 14, marginBottom: 20, gap: 10 },
  splitItem:      { flexDirection: 'row', alignItems: 'center' },
  payoutBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#a78bfa', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
  payoutBtnText:  { color: '#fff', fontWeight: '800', fontSize: 16 },
  minHint:        { color: '#555', fontSize: 11, marginTop: 10, textAlign: 'center' },
  statsRow:       { flexDirection: 'row', padding: 8, paddingHorizontal: 12, gap: 8 },
  statBox:        { flex: 1, backgroundColor: '#141414', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1f1f1f' },
  statIcon:       { fontSize: 22, marginBottom: 6 },
  statValue:      { color: '#fff', fontSize: 14, fontWeight: '800' },
  statLabel:      { color: '#555', fontSize: 10, marginTop: 2 },
  howItWorksCard: { backgroundColor: '#141414', margin: 12, marginTop: 4, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#1f1f1f' },
  howTitle:       { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 14 },
  howRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  howText:        { color: '#888', fontSize: 13, flex: 1, lineHeight: 18 },
  emptyState:     { alignItems: 'center', paddingTop: 60 },
  emptyText:      { color: '#444', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyHint:      { color: '#333', fontSize: 13, marginTop: 6 },
  payoutRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1f1f1f' },
  payoutBeans:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  payoutUSD:      { color: '#a78bfa', fontSize: 13, marginTop: 2 },
  payoutDate:     { color: '#555', fontSize: 11, marginTop: 4 },
  statusBadge:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText:     { fontSize: 11, fontWeight: '800' },
});
