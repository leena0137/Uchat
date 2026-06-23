import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Platform
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import {
  collection, onSnapshot, doc, updateDoc, query,
  where, getDocs, serverTimestamp, addDoc, getDoc
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { beansToUSD, AGENCY_CUT } from '../utils/economy';

export default function AgencyScreen({ navigation }) {
  const [myHosts, setMyHosts]         = useState([]);
  const [payouts, setPayouts]         = useState([]);
  const [userData, setUserData]       = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting]       = useState(false);
  const [activeTab, setActiveTab]     = useState('hosts');
  const user = auth.currentUser;

  useEffect(() => {
    if (!user?.uid) return;
    // Load agency owner's data
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    // Load hosts that belong to this agency
    const unsub = onSnapshot(
      query(collection(db, 'users'), where('agencyId', '==', user.uid)),
      (snap) => {
        setMyHosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    // Load payouts where this agency gets commission
    const unsub = onSnapshot(
      query(collection(db, 'payoutRequests'), where('agencyId', '==', user.uid)),
      (snap) => {
        setPayouts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return unsub;
  }, [user?.uid]);

  const totalCommission = payouts
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + (p.agencyAmount || 0), 0);

  const totalHostBeans = myHosts.reduce((sum, h) => sum + (h.beans || 0), 0);

  const handleInviteHost = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email or user ID');
      return;
    }
    setInviting(true);
    try {
      // Find user by email
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', inviteEmail.trim()))
      );
      if (usersSnap.empty) {
        Alert.alert('Not Found', 'No user found with that email. Make sure they have an account.');
        setInviting(false);
        return;
      }
      const targetDoc = usersSnap.docs[0];
      const targetData = targetDoc.data();

      if (targetData.agencyId) {
        Alert.alert('Already in Agency', 'This user already belongs to an agency.');
        setInviting(false);
        return;
      }

      // Send agency invite
      await addDoc(collection(db, 'agencyInvites'), {
        agencyId:    user.uid,
        agencyName:  userData?.displayName || 'Agency',
        targetUid:   targetDoc.id,
        targetEmail: inviteEmail.trim(),
        status:      'pending',
        createdAt:   serverTimestamp(),
      });

      setInviteEmail('');
      Alert.alert('✅ Invite Sent', `Agency invite sent to ${inviteEmail}. They need to accept it from their profile.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setInviting(false);
    }
  };

  const removeHost = async (hostId, hostName) => {
    Alert.alert(
      'Remove Host',
      `Remove ${hostName} from your agency?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', hostId), { agencyId: null });
              Alert.alert('Done', `${hostName} removed from agency.`);
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Agency Hub</Text>
          <Text style={styles.headerSub}>Manage your hosts & earnings</Text>
        </View>
        <View style={styles.agencyBadge}>
          <Ionicons name="briefcase" size={12} color="#34D399" />
          <Text style={styles.agencyBadgeText}>AGENCY</Text>
        </View>
      </Animated.View>

      {/* Summary Cards */}
      <Animated.View entering={ZoomIn.duration(500)} style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: '#34D39940' }]}>
          <Text style={styles.summaryValue}>{myHosts.length}</Text>
          <Text style={styles.summaryLabel}>Hosts</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: '#a78bfa40' }]}>
          <Text style={[styles.summaryValue, { color: '#a78bfa' }]}>🫘 {totalHostBeans}</Text>
          <Text style={styles.summaryLabel}>Host Beans</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: '#FF3B8B40' }]}>
          <Text style={[styles.summaryValue, { color: '#FF3B8B' }]}>{beansToUSD(totalCommission)}</Text>
          <Text style={styles.summaryLabel}>My Commission</Text>
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['hosts', 'invite', 'earnings'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'hosts' ? '🎤 Hosts' : tab === 'invite' ? '➕ Invite' : '💰 Earnings'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* HOSTS TAB */}
        {activeTab === 'hosts' && (
          <Animated.View entering={FadeInUp.duration(400)}>
            {myHosts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#333" />
                <Text style={styles.emptyText}>No hosts yet</Text>
                <Text style={styles.emptyHint}>Use the Invite tab to add hosts to your agency</Text>
                <TouchableOpacity
                  style={styles.emptyAction}
                  onPress={() => setActiveTab('invite')}
                >
                  <Text style={{ color: '#34D399', fontWeight: '700' }}>+ Invite a Host</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myHosts.map((host, i) => (
                <Animated.View key={host.id} entering={FadeInDown.delay(i * 60).duration(300)}>
                  <View style={styles.hostCard}>
                    <View style={styles.hostAvatar}>
                      <Text style={{ fontSize: 24 }}>{host.avatar || '😊'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hostName}>{host.displayName || 'Host'}</Text>
                      <View style={styles.hostStats}>
                        <Text style={styles.hostStat}>🫘 {host.beans || 0} beans</Text>
                        <Text style={styles.hostStat}>🎁 {host.totalGiftsReceived || 0} gifts</Text>
                      </View>
                      <Text style={styles.hostCommission}>
                        Your cut: {beansToUSD(Math.floor((host.beans || 0) * AGENCY_CUT))}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeHost(host.id, host.displayName)}
                    >
                      <Ionicons name="close-circle" size={22} color="#FF3B3B60" />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ))
            )}
          </Animated.View>
        )}

        {/* INVITE TAB */}
        {activeTab === 'invite' && (
          <Animated.View entering={FadeInUp.duration(400)} style={{ padding: 16 }}>
            <View style={styles.inviteCard}>
              <Text style={styles.inviteTitle}>Invite a Host</Text>
              <Text style={styles.inviteHint}>
                Enter the host's email. They'll receive an agency invite and can accept from their profile.
              </Text>
              <TextInput
                style={styles.inviteInput}
                placeholder="host@email.com"
                placeholderTextColor="#555"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.inviteBtn, inviting && { opacity: 0.6 }]}
                onPress={handleInviteHost}
                disabled={inviting}
              >
                {inviting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.inviteBtnText}>Send Invite</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.commissionCard}>
              <Text style={styles.commissionTitle}>Your Commission Rate</Text>
              <View style={styles.commissionRate}>
                <Text style={styles.commissionPct}>20%</Text>
                <Text style={styles.commissionDesc}>of all host payout beans</Text>
              </View>
              <Text style={styles.commissionNote}>
                When a host in your agency cashes out, you automatically receive 20% of their beans as commission.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* EARNINGS TAB */}
        {activeTab === 'earnings' && (
          <Animated.View entering={FadeInUp.duration(400)}>
            {payouts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cash-outline" size={48} color="#333" />
                <Text style={styles.emptyText}>No earnings yet</Text>
                <Text style={styles.emptyHint}>Commission appears when your hosts request payouts</Text>
              </View>
            ) : (
              payouts.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(i * 50).duration(300)}>
                  <View style={styles.earningRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.earningHost}>{p.hostName}</Text>
                      <Text style={styles.earningDate}>
                        {p.createdAt?.toDate?.()?.toLocaleDateString() || 'Just now'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.earningAmount}>{beansToUSD(p.agencyAmount || 0)}</Text>
                      <View style={[styles.statusBadge, {
                        backgroundColor: p.status === 'approved' ? '#34D39920' : '#FCD34D20'
                      }]}>
                        <Text style={[styles.statusText, {
                          color: p.status === 'approved' ? '#34D399' : '#FCD34D'
                        }]}>
                          {(p.status || 'pending').toUpperCase()}
                        </Text>
                      </View>
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

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0D0D0D' },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 55 : 24, paddingBottom: 16, gap: 12 },
  backBtn:          { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  headerTitle:      { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub:        { color: '#666', fontSize: 12 },
  agencyBadge:      { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', backgroundColor: '#34D39920', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#34D39940', gap: 4 },
  agencyBadgeText:  { color: '#34D399', fontSize: 11, fontWeight: '800' },
  summaryRow:       { flexDirection: 'row', padding: 12, gap: 8 },
  summaryCard:      { flex: 1, backgroundColor: '#141414', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1 },
  summaryValue:     { color: '#34D399', fontSize: 18, fontWeight: '800' },
  summaryLabel:     { color: '#666', fontSize: 11, marginTop: 4 },
  tabs:             { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', marginBottom: 4 },
  tab:              { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab:        { borderBottomWidth: 2, borderBottomColor: '#34D399' },
  tabText:          { color: '#666', fontSize: 12, fontWeight: '600' },
  activeTabText:    { color: '#34D399' },
  hostCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', marginHorizontal: 12, marginBottom: 8, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1f1f1f', gap: 12 },
  hostAvatar:       { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1f1f1f', justifyContent: 'center', alignItems: 'center' },
  hostName:         { color: '#fff', fontSize: 15, fontWeight: '700' },
  hostStats:        { flexDirection: 'row', gap: 12, marginTop: 4 },
  hostStat:         { color: '#666', fontSize: 12 },
  hostCommission:   { color: '#34D399', fontSize: 12, marginTop: 4, fontWeight: '600' },
  removeBtn:        { padding: 4 },
  emptyState:       { alignItems: 'center', paddingTop: 60 },
  emptyText:        { color: '#444', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyHint:        { color: '#333', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
  emptyAction:      { marginTop: 20, backgroundColor: '#34D39920', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#34D39940' },
  inviteCard:       { backgroundColor: '#141414', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 16 },
  inviteTitle:      { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  inviteHint:       { color: '#666', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  inviteInput:      { backgroundColor: '#0f0f0f', color: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 12, fontSize: 14 },
  inviteBtn:        { backgroundColor: '#34D399', borderRadius: 12, padding: 14, alignItems: 'center' },
  inviteBtnText:    { color: '#000', fontWeight: '800', fontSize: 15 },
  commissionCard:   { backgroundColor: '#141414', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#34D39930' },
  commissionTitle:  { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  commissionRate:   { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10 },
  commissionPct:    { color: '#34D399', fontSize: 42, fontWeight: '900' },
  commissionDesc:   { color: '#888', fontSize: 14 },
  commissionNote:   { color: '#555', fontSize: 12, lineHeight: 18 },
  earningRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', marginHorizontal: 12, marginBottom: 8, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1f1f1f' },
  earningHost:      { color: '#fff', fontSize: 14, fontWeight: '700' },
  earningDate:      { color: '#555', fontSize: 12, marginTop: 2 },
  earningAmount:    { color: '#34D399', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  statusBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText:       { fontSize: 10, fontWeight: '800' },
});
