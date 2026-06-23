import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, ZoomIn, FadeInDown, FadeInUp, BounceIn } from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { doc, updateDoc, setDoc, increment, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { awardWinner, GAME_REWARDS, GAME_FEES } from '../../utils/gameRewards';

const CARS = [
  { id: 'red',    color: '#FF4081', emoji: '🏎️', name: 'Phantom Red'   },
  { id: 'blue',   color: '#00E5FF', emoji: '🚀', name: 'Neon Rocket'   },
  { id: 'green',  color: '#4CAF50', emoji: '🚙', name: 'Toxic Green'   },
  { id: 'yellow', color: '#FFD700', emoji: '🚕', name: 'Solar Yellow'  },
];

// ─── Car lane component (hooks OUTSIDE map) ──────────────────────────────────
function CarLane({ player, progress, index }) {
  const pos = useSharedValue(0);

  useEffect(() => {
    pos.value = withTiming(progress, { duration: 600, easing: Easing.out(Easing.quad) });
  }, [progress]);

  const animStyle = useAnimatedStyle(() => ({
    // moves car from 5% (start) toward 85% (finish) from the left
    left: `${pos.value}%`,
  }));

  return (
    <View style={styles.lane}>
      {/* Finish line */}
      <View style={styles.finishLine} />

      {/* Lane label */}
      <Text style={styles.laneLabel}>{'─'.repeat(40)}</Text>

      {player ? (
        <Animated.View style={[styles.carWrapper, animStyle]}>
          <Text style={[styles.carEmoji, { textShadowColor: player.color }]}>
            {player.emoji || '🏎️'}
          </Text>
          <Text style={[styles.racerName, { borderColor: player.color }]} numberOfLines={1}>
            {player.name}
          </Text>
        </Animated.View>
      ) : (
        <Text style={styles.emptyLane}>Lane {index + 1}</Text>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CarGame({ gameState, roomId, onClose, isHost }) {
  const [players, setPlayers]     = useState({});
  const [status, setStatus]       = useState('waiting');
  const [winner, setWinner]       = useState(null);
  const [reward, setReward]       = useState(null); // { coins, diamonds }
  const rewardedRef               = useRef(false);

  const clickBufferRef = useRef(0);
  const syncTimerRef   = useRef(null);

  // Read Firebase game state + trigger reward for local winner
  useEffect(() => {
    if (gameState?.carGame) {
      const g = gameState.carGame;
      setPlayers(g.players || {});
      setStatus(g.status   || 'waiting');
      const w = g.winner   || null;
      setWinner(w);

      // Award coins/diamonds once to the winner
      const me = auth.currentUser;
      if (w && me && w.id === me.uid && !rewardedRef.current) {
        rewardedRef.current = true;
        awardWinner(me.uid, 'car').then(r => r && setReward(r));
      }
    }
  }, [gameState?.carGame]);

  // Sync click buffer to Firebase every second
  useEffect(() => {
    if (status === 'playing') {
      syncTimerRef.current = setInterval(async () => {
        const user = auth.currentUser;
        if (!user || clickBufferRef.current === 0) return;

        const toSend = clickBufferRef.current;
        clickBufferRef.current = 0;

        try {
          const currentClicks = players[user.uid]?.clicks || 0;
          const newTotal = currentClicks + toSend;

          const updates = {
            [`gameState.carGame.players.${user.uid}.clicks`]: newTotal,
          };

          if (newTotal >= 50 && !winner) {
            updates['gameState.carGame.status'] = 'finished';
            updates['gameState.carGame.winner'] = players[user.uid];
          }

          await updateDoc(doc(db, 'rooms', roomId), updates);
        } catch (e) {
          console.error('Sync error:', e);
        }
      }, 1000);
    } else {
      clearInterval(syncTimerRef.current);
    }
    return () => clearInterval(syncTimerRef.current);
  }, [status, roomId, players, winner]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const selectCar = async (car) => {
    const user = auth.currentUser;
    if (!user) return;

    const pArr = Object.values(players);
    if (pArr.length >= 4) return;
    if (players[user.uid]) return;
    if (pArr.find(p => p.carId === car.id)) {
      Alert.alert('Taken', 'This car is already taken! Pick another.');
      return;
    }

    const fee = GAME_FEES.car.coins;
    const userRef = doc(db, 'users', user.uid);

    try {
      const snap = await getDoc(userRef);
      const userCoins = snap.exists() ? (snap.data().coins || 0) : 0;

      if (userCoins < fee) {
        Alert.alert('Not enough Coins', `You need ${fee} coins to enter this race. Buy more in the Coin Shop!`);
        return;
      }

      await setDoc(userRef, { coins: increment(-fee) }, { merge: true });

      await updateDoc(doc(db, 'rooms', roomId), {
        [`gameState.carGame.players.${user.uid}`]: {
          id:     user.uid,
          name:   user.displayName || 'Racer',
          color:  car.color,
          carId:  car.id,
          emoji:  car.emoji,
          clicks: 0,
        },
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to join race.');
    }
  };

  const startRace = async () => {
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        'gameState.carGame.status': 'playing',
        'gameState.carGame.winner': null,
      });
    } catch (e) {}
  };

  const tapGas = () => {
    if (status !== 'playing') return;
    clickBufferRef.current += 1;
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const pArr     = Object.values(players);
  const myPlayer = players[auth.currentUser?.uid];
  const myClicks = myPlayer?.clicks || 0;

  // Progress 0-90% mapped from 0-50 clicks
  const getProgress = (clicks) => Math.min((clicks / 50) * 85, 85);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🏁 NEON RACE</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close-circle" size={32} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.gameArea} showsVerticalScrollIndicator={false}>

        {/* Win Reward Overlay */}
        {reward && (
          <View style={styles.rewardBox}>
            <Text style={styles.rewardTitle}>🏆 YOU WIN!</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardItem}>🪙 +{reward.coins}</Text>
              <Text style={styles.rewardItem}>💎 +{reward.diamonds}</Text>
            </View>
            <TouchableOpacity onPress={() => setReward(null)} style={styles.rewardClose}>
              <Text style={styles.rewardCloseText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status banner */}
        {status === 'finished' && winner ? (
          <View style={[styles.winnerBanner, { borderColor: winner.color, shadowColor: winner.color }]}>
            <Text style={styles.winnerEmoji}>{winner.emoji}</Text>
            <Text style={[styles.winnerText, { color: winner.color }]}>{winner.name} WINS! 🎉</Text>
            <Text style={styles.rewardHint}>+{GAME_REWARDS.car.coins}🪙  +{GAME_REWARDS.car.diamonds}💎</Text>
          </View>
        ) : (
          <Text style={styles.infoText}>
            {status === 'waiting' && !myPlayer  ? '🚗  CHOOSE YOUR RIDE!' :
             status === 'waiting'               ? '⏳  Waiting for host to start...' :
                                                  '🔥  TAP GAS TO RACE!'}
          </Text>
        )}

        {/* ── Race Track ── */}
        <View style={styles.track}>
          {[0, 1, 2, 3].map(i => (
            <CarLane
              key={i}
              index={i}
              player={pArr[i] || null}
              progress={pArr[i] ? getProgress(pArr[i].clicks) : 0}
            />
          ))}
        </View>

        {/* ── Car Selection Grid ── */}
        {status === 'waiting' && !myPlayer && (
          <View style={styles.selectionSection}>
            <Text style={styles.sectionTitle}>🏎️ TAP A CAR TO JOIN</Text>
            <Text style={styles.feeHint}>Entry fee: {GAME_FEES.car.coins} 🪙 per race</Text>
            <View style={styles.carGrid}>
              {CARS.map(car => {
                const isTaken = !!pArr.find(p => p.carId === car.id);
                return (
                  <TouchableOpacity
                    key={car.id}
                    style={[styles.carCard, { borderColor: car.color }, isTaken && styles.carCardTaken]}
                    onPress={() => selectCar(car)}
                    disabled={isTaken}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.carCardEmoji, { opacity: isTaken ? 0.3 : 1 }]}>{car.emoji}</Text>
                    <Text style={[styles.carCardName, { color: isTaken ? '#555' : car.color }]}>{car.name}</Text>
                    {isTaken
                      ? <Text style={styles.takenBadge}>TAKEN</Text>
                      : <Text style={styles.selectBadge}>TAP TO JOIN</Text>
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Start Button */}
        {status === 'waiting' && pArr.length > 0 && (
          <TouchableOpacity style={styles.startBtn} onPress={startRace} activeOpacity={0.8}>
            <Text style={styles.startBtnText}>🚦 START RACE</Text>
          </TouchableOpacity>
        )}

        {/* GAS PEDAL */}
        {status === 'playing' && myPlayer && (
          <View style={styles.gasSection}>
            <Text style={styles.speedText}>{Math.round(getProgress(myClicks))} mph</Text>
            <TouchableOpacity style={[styles.gasBtn, { shadowColor: myPlayer.color, borderColor: myPlayer.color }]} onPress={tapGas} activeOpacity={0.6}>
              <Text style={styles.gasBtnText}>GAS</Text>
              <Text style={styles.gasSubText}>TAP!</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#05050F',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderBottomWidth: 1,
    borderBottomColor: '#00E5FF33',
  },
  title: {
    color: '#00E5FF',
    fontSize: 26,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: '#00E5FF',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  gameArea: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 20,
  },

  // Status
  infoText: {
    color: '#FF4081',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 20,
    textShadowColor: '#FF4081',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
    textAlign: 'center',
  },
  winnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 2,
    paddingHorizontal: 25,
    paddingVertical: 12,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  winnerEmoji: { fontSize: 36 },
  winnerText: {
    fontSize: 26,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },

  // Track
  track: {
    width: '95%',
    backgroundColor: '#0d0d1a',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#00E5FF',
    overflow: 'hidden',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
    marginBottom: 25,
  },
  lane: {
    height: 80,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  laneLabel: {
    color: '#1a1a2e',
    fontSize: 10,
    position: 'absolute',
    width: '100%',
    paddingHorizontal: 5,
  },
  finishLine: {
    position: 'absolute',
    right: '8%',
    width: 6,
    height: '100%',
    backgroundColor: '#fff',
    opacity: 0.5,
    borderRadius: 3,
  },
  carWrapper: {
    position: 'absolute',
    alignItems: 'center',
    // starts near left edge
    left: '5%',
  },
  carEmoji: {
    fontSize: 52,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  racerName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 2,
    maxWidth: 70,
    textAlign: 'center',
  },
  emptyLane: {
    color: '#333',
    fontSize: 13,
    fontStyle: 'italic',
    marginLeft: 12,
  },

  // Car selection
  selectionSection: {
    width: '95%',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#00E5FF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 15,
    textShadowColor: '#00E5FF',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  carGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  carCard: {
    width: '44%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 2,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    position: 'relative',
  },
  carCardTaken: {
    borderColor: '#333',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  carCardEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  carCardName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  takenBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF0000',
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },

  // Buttons
  startBtn: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    paddingHorizontal: 50,
    borderRadius: 30,
    shadowColor: '#FFD700',
    shadowOpacity: 0.8,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    marginBottom: 20,
  },
  startBtnText: {
    color: '#000',
    fontSize: 22,
    fontWeight: '900',
  },

  // Gas section
  gasSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  speedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    opacity: 0.7,
  },
  gasBtn: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#1a0010',
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
  },
  gasBtnText: {
    color: '#FF4081',
    fontSize: 38,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: '#FF4081',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  gasSubText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    opacity: 0.6,
    marginTop: 2,
  },

  // Reward overlay
  rewardBox: {
    width: '90%',
    backgroundColor: '#0d1a00',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
  },
  rewardTitle: {
    color: '#FFD700',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 16,
    textShadowColor: '#FFD700',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  rewardItem: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  rewardClose: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 30,
  },
  rewardCloseText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 18,
  },
  rewardHint: {
    color: 'rgba(255,215,0,0.7)',
    fontSize: 14,
    marginTop: 6,
    fontWeight: 'bold',
  },
  joinBtn: {
    marginTop: 20,
    backgroundColor: '#00E5FF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    shadowColor: '#00E5FF',
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  btnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
  },
  feeHint: {
    color: '#FFD700',
    fontSize: 13,
    marginBottom: 12,
    fontWeight: '600',
    opacity: 0.85,
  },
  selectBadge: {
    marginTop: 6,
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: '#00E5FF',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
});
