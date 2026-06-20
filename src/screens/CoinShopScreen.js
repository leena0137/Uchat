import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import {
  doc, getDoc, updateDoc, addDoc, collection,
  serverTimestamp, increment, onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { COIN_PACKAGES } from '../utils/economy';

const PACKAGE_COLORS = ['#FF6B6B', '#FF3B8B', '#a78bfa', '#34D399'];
const PACKAGE_ICONS  = ['💰', '💎', '🚀', '👑'];

export default function CoinShopScreen({ navigation }) {
  const [userCoins, setUserCoins]     = useState(0);
  const [purchasing, setPurchasing]   = useState(null);
  const [history, setHistory]         = useState([]);
  const [activeTab, setActiveTab]     = useState('shop');
  const user = auth.currentUser;

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setUserCoins(snap.data().coins || 0);
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      collection(db, 'users', user.uid, 'coinTransactions'),
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setHistory(list);
      }
    );
    return unsub;
  }, [user?.uid]);

  const handleBuy = async (pkg) => {
    Alert.alert(
      `Buy ${pkg.coins + pkg.bonus} Coins`,
      `Purchase ${pkg.coins} coins${pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : ''} for ${pkg.price}?\n\n(Demo: coins added instantly)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy Now',
          onPress: async () => {
            setPurchasing(pkg.id);
            try {
              const total = pkg.coins + pkg.bonus;
              await updateDoc(doc(db, 'users', user.uid), {
                coins: increment(total)
              });
              await addDoc(collection(db, 'users', user.uid, 'coinTransactions'), {
                type:        'purchase',
                packageId:   pkg.id,
                coins:       pkg.coins,
                bonus:       pkg.bonus,
                total,
                price:       pkg.price,
                createdAt:   serverTimestamp(),
              });
              // Platform transaction log
              await addDoc(collection(db, 'transactions'), {
                type:        'coin_purchase',
                userId:      user.uid,
                userName:    user.displayName || 'User',
                packageId:   pkg.id,
                coins:       total,
                price:       pkg.price,
                createdAt:   serverTimestamp(),
              });
              Alert.alert('🎉 Success!', `+${total} coins added to your wallet!`);
            } catch (e) {
              Alert.alert('Error', e.message);
            } finally {
              setPurchasing(null);
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
          <Text style={styles.headerTitle}>Coin Shop</Text>
          <Text style={styles.headerSub}>Power up your gifting</Text>
        </View>
        <View style={styles.walletBadge}>
          <Ionicons name="wallet" size={14} color="#FFD700" />
          <Text style={styles.walletText}>{userCoins.toLocaleString()}</Text>
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['shop', 'history'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'shop' ? '🛒 Shop' : '📋 History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {activeTab === 'shop' && (
          <>
            {/* Balance Card */}
            <Animated.View entering={FadeInUp.duration(500)} style={styles.balanceCard}>
              <View style={styles.balanceGlow} />
              <Text style={styles.balanceLabel}>Your Coin Balance</Text>
              <Text style={styles.balanceAmount}>🪙 {userCoins.toLocaleString()}</Text>
              <Text style={styles.balanceHint}>Use coins to send gifts to your favourite hosts</Text>
            </Animated.View>

            {/* Packages */}
            <Text style={styles.sectionTitle}>Choose a Package</Text>
            {COIN_PACKAGES.map((pkg, i) => (
              <Animated.View key={pkg.id} entering={FadeInDown.delay(i * 80).duration(400)}>
                <TouchableOpacity
                  style={[styles.pkgCard, { borderColor: PACKAGE_COLORS[i] + '50' }]}
                  onPress={() => handleBuy(pkg)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.pkgIcon, { backgroundColor: PACKAGE_COLORS[i] + '20' }]}>
                    <Text style={{ fontSize: 28 }}>{PACKAGE_ICONS[i]}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.pkgLabel}>{pkg.label}</Text>
                      {pkg.bonus > 0 && (
                        <View style={styles.bonusBadge}>
                          <Text style={styles.bonusText}>+{pkg.bonus} BONUS</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.pkgCoins}>
                      🪙 {(pkg.coins + pkg.bonus).toLocaleString()} coins
                    </Text>
                    {pkg.bonus > 0 && (
                      <Text style={styles.pkgBreakdown}>
                        {pkg.coins} + {pkg.bonus} bonus
                      </Text>
                    )}
                  </View>
                  {purchasing === pkg.id ? (
                    <ActivityIndicator size="small" color={PACKAGE_COLORS[i]} />
                  ) : (
                    <View style={[styles.priceBtn, { backgroundColor: PACKAGE_COLORS[i] }]}>
                      <Text style={styles.priceText}>{pkg.price}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            ))}

            {/* Info */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={16} color="#666" />
              <Text style={styles.infoText}>
                Coins are non-refundable. When you send gifts, hosts earn Beans which can be cashed out.
              </Text>
            </View>
          </>
        )}

        {activeTab === 'history' && (
          <Animated.View entering={FadeInUp.duration(400)}>
            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color="#333" />
                <Text style={styles.emptyText}>No purchases yet</Text>
                <Text style={styles.emptyHint}>Your coin purchase history will appear here</Text>
              </View>
            ) : (
              history.map((tx, i) => (
                <Animated.View key={tx.id} entering={FadeInDown.delay(i * 50).duration(300)}>
                  <View style={styles.historyRow}>
                    <View style={styles.historyIcon}>
                      <Text style={{ fontSize: 20 }}>
                        {tx.type === 'purchase' ? '🪙' : tx.type === 'gift_sent' ? '🎁' : '💸'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyTitle}>
                        {tx.type === 'purchase' ? `Bought ${tx.total} coins` :
                         tx.type === 'gift_sent' ? `Sent gift (-${tx.coins})` : tx.type}
                      </Text>
                      <Text style={styles.historyDate}>
                        {tx.createdAt?.toDate?.()?.toLocaleDateString() || 'Just now'}
                      </Text>
                    </View>
                    <Text style={[styles.historyAmount, {
                      color: tx.type === 'purchase' ? '#34D399' : '#FF3B8B'
                    }]}>
                      {tx.type === 'purchase' ? `+${tx.total}` : `-${tx.coins || 0}`}
                    </Text>
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
  container:      { flex: 1, backgroundColor: '#0D0D0D' },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 55 : 24, paddingBottom: 16 },
  backBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle:    { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub:      { color: '#666', fontSize: 12 },
  walletBadge:    { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD70020', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#FFD70040', gap: 5 },
  walletText:     { color: '#FFD700', fontWeight: 'bold', fontSize: 13 },
  tabs:           { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', marginBottom: 4 },
  tab:            { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab:      { borderBottomWidth: 2, borderBottomColor: '#FFD700' },
  tabText:        { color: '#666', fontSize: 13, fontWeight: '600' },
  activeTabText:  { color: '#FFD700' },
  balanceCard:    { margin: 16, borderRadius: 22, backgroundColor: '#141414', padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#FFD70030', overflow: 'hidden' },
  balanceGlow:    { position: 'absolute', top: -40, width: 200, height: 100, borderRadius: 100, backgroundColor: '#FFD70015' },
  balanceLabel:   { color: '#888', fontSize: 13, marginBottom: 8 },
  balanceAmount:  { color: '#FFD700', fontSize: 36, fontWeight: '900', marginBottom: 8 },
  balanceHint:    { color: '#555', fontSize: 12, textAlign: 'center' },
  sectionTitle:   { color: '#fff', fontSize: 17, fontWeight: '700', marginHorizontal: 16, marginBottom: 12, marginTop: 4 },
  pkgCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', marginHorizontal: 16, marginBottom: 10, borderRadius: 18, padding: 16, borderWidth: 1 },
  pkgIcon:        { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  pkgLabel:       { color: '#fff', fontSize: 16, fontWeight: '700' },
  pkgCoins:       { color: '#FFD700', fontSize: 14, fontWeight: '600', marginTop: 4 },
  pkgBreakdown:   { color: '#555', fontSize: 11, marginTop: 2 },
  bonusBadge:     { backgroundColor: '#FF3B8B20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#FF3B8B40' },
  bonusText:      { color: '#FF3B8B', fontSize: 10, fontWeight: '800' },
  priceBtn:       { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  priceText:      { color: '#fff', fontWeight: '800', fontSize: 14 },
  infoCard:       { flexDirection: 'row', backgroundColor: '#0f0f0f', margin: 16, borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: '#1f1f1f' },
  infoText:       { color: '#555', fontSize: 12, flex: 1, lineHeight: 18 },
  emptyState:     { alignItems: 'center', paddingTop: 60 },
  emptyText:      { color: '#444', fontSize: 16, marginTop: 12, fontWeight: '600' },
  emptyHint:      { color: '#333', fontSize: 13, marginTop: 6 },
  historyRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1f1f1f', gap: 12 },
  historyIcon:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  historyTitle:   { color: '#fff', fontSize: 14, fontWeight: '600' },
  historyDate:    { color: '#555', fontSize: 12, marginTop: 2 },
  historyAmount:  { fontSize: 16, fontWeight: '800' },
});
