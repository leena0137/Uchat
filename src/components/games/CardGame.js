import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInUp, BounceIn, ZoomIn, ZoomInEasyDown, FlipInYLeft, useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, setDoc, increment, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { awardWinner, GAME_REWARDS, GAME_FEES } from '../../utils/gameRewards';

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Helper to calculate card value
const getCardScore = (value) => {
  return VALUES.indexOf(value);
};

export default function CardGame({ gameState, roomId, onClose, isHost }) {
  const [players, setPlayers] = useState({});
  const [status, setStatus] = useState('waiting');
  const [winner, setWinner] = useState(null);
  const [reward, setReward] = useState(null);
  const rewardedRef = React.useRef(false);

  const [localCard, setLocalCard] = useState(null);
  const [isFlipping, setIsFlipping] = useState(false);
  
  const rotateY = useSharedValue(0);

  useEffect(() => {
    if (gameState?.cardGame) {
      setPlayers(gameState.cardGame.players || {});
      setStatus(gameState.cardGame.status || 'waiting');
      const w = gameState.cardGame.winner || null;
      setWinner(w);

      const me = auth.currentUser;
      if (w && me && w.id === me.uid && !rewardedRef.current) {
        rewardedRef.current = true;
        awardWinner(me.uid, 'cards').then(r => r && setReward(r));
      }
    }
  }, [gameState?.cardGame]);

  useEffect(() => {
    if (gameState?.lastAction?.type === 'card') {
      const cardValue = gameState.lastAction.value;
      setIsFlipping(true);
      rotateY.value = withSequence(
        withTiming(90, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) }, (finished) => {
          if (finished) {
            runOnJS(setLocalCard)(cardValue);
            runOnJS(setIsFlipping)(false);
          }
        })
      );
    } else {
      setLocalCard(null);
    }
  }, [gameState?.lastAction?.timestamp]);

  const joinGame = async () => {
    const user = auth.currentUser;
    if (!user || players[user.uid]) return;
    
    const fee = GAME_FEES.cards.coins;
    const userRef = doc(db, 'users', user.uid);

    try {
      const snap = await getDoc(userRef);
      const userCoins = snap.exists() ? (snap.data().coins || 0) : 0;
      
      if (userCoins < fee) {
        Alert.alert('Not enough Coins', `You need ${fee} coins to enter this game. Buy more in the Coin Shop!`);
        return;
      }
      
      await setDoc(userRef, { coins: increment(-fee) }, { merge: true });

      await updateDoc(doc(db, 'rooms', roomId), {
        [`gameState.cardGame.players.${user.uid}`]: {
          id: user.uid,
          name: user.displayName || 'Player',
          card: null,
          score: null
        }
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to join game.');
    }
  };

  const startGame = async () => {
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        'gameState.cardGame.status': 'playing',
        'gameState.cardGame.winner': null
      });
    } catch (e) {}
  };

  const handleFlip = async () => {
    if (isFlipping || status !== 'playing') return;
    const user = auth.currentUser;
    if (!user || !players[user.uid] || players[user.uid].card !== null) return;

    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const value = VALUES[Math.floor(Math.random() * VALUES.length)];
    const score = getCardScore(value);
    
    const newPlayers = { ...players };
    newPlayers[user.uid].card = { suit, value };
    newPlayers[user.uid].score = score;

    let isFinished = true;
    let currentWinner = null;
    let maxScore = -1;

    Object.values(newPlayers).forEach(p => {
      if (p.score === null) isFinished = false;
      if (p.score !== null && p.score > maxScore) {
        maxScore = p.score;
        currentWinner = p;
      }
    });

    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        'gameState.lastAction': {
          type: 'card',
          userId: user.uid,
          userName: user.displayName || 'Player',
          value: { suit, value },
          timestamp: Date.now()
        },
        'gameState.cardGame.players': newPlayers,
        ...(isFinished ? {
          'gameState.cardGame.status': 'finished',
          'gameState.cardGame.winner': currentWinner
        } : {})
      });
    } catch (e) {}
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotateY.value}deg` }
      ],
    };
  });

  const getCardColor = () => {
    if (!localCard) return '#000';
    return (localCard.suit === '♥️' || localCard.suit === '♦️') ? '#FF0000' : '#000000';
  };

  const pArr = Object.values(players);
  const myPlayer = players[auth.currentUser?.uid];

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <Text style={styles.title}>CARD DRAW</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close-circle" size={30} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.gameArea}>
        <Animated.View entering={FadeInUp.duration(700).delay(200)} style={styles.glassPanel}>
          
          {/* Reward Overlay */}
          {reward && (
            <Animated.View entering={ZoomIn.duration(500).springify()} style={styles.rewardBox}>
              <Text style={styles.rewardTitle}>🏆 HIGH CARD WINS!</Text>
              <View style={styles.rewardRow}>
                <Text style={styles.rewardItem}>🪙 +{reward.coins}</Text>
                <Text style={styles.rewardItem}>💎 +{reward.diamonds}</Text>
              </View>
              <TouchableOpacity onPress={() => setReward(null)} style={styles.rewardClose}>
                <Text style={styles.rewardCloseText}>Claim!</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {status === 'finished' && winner ? (
            <Animated.Text entering={BounceIn.duration(700)} style={styles.winnerText}>
              {winner.name} WINS!{'  '}🪙+{GAME_REWARDS.cards.coins}  💎+{GAME_REWARDS.cards.diamonds}
            </Animated.Text>
          ) : (
            <Animated.Text entering={FadeInDown.duration(400).delay(200)} style={styles.lastAction}>
              {status === 'waiting' ? 'Waiting for players...' : 
               status === 'playing' && myPlayer?.card === null ? 'YOUR TURN TO DRAW!' : 
               'Waiting for others to draw...'}
            </Animated.Text>
          )}
          
          <TouchableOpacity activeOpacity={0.9} onPress={handleFlip} disabled={isFlipping || status !== 'playing' || myPlayer?.card !== null}>
            <Animated.View style={[styles.cardContainer, animatedStyle]}>
              <View style={styles.cardGlow} />
              {!localCard || isFlipping ? (
                <View style={styles.cardBack}>
                  <Ionicons name="infinite" size={60} color="#00E5FF" />
                </View>
              ) : (
                <View style={styles.cardFront}>
                  <Text style={[styles.cardTopLeft, { color: getCardColor() }]}>{localCard.value}</Text>
                  <Text style={[styles.cardSuitTop, { color: getCardColor() }]}>{localCard.suit}</Text>
                  
                  <Text style={[styles.cardCenter, { color: getCardColor() }]}>{localCard.suit}</Text>
                  
                  <Text style={[styles.cardBottomRight, { color: getCardColor() }]}>{localCard.value}</Text>
                  <Text style={[styles.cardSuitBottom, { color: getCardColor() }]}>{localCard.suit}</Text>
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>
          
          {status === 'waiting' && !myPlayer && (
            <Animated.View entering={ZoomInEasyDown.duration(500).delay(400)}>
              <TouchableOpacity style={styles.joinBtn} onPress={joinGame}>
                <Text style={styles.btnText}>JOIN GAME ({GAME_FEES.cards.coins} 🪙)</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {status === 'waiting' && pArr.length > 0 && (
            <Animated.View entering={ZoomInEasyDown.duration(500).delay(500)}>
              <TouchableOpacity style={styles.startBtn} onPress={startGame}>
                <Text style={styles.btnText}>START GAME</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {status === 'playing' && myPlayer && myPlayer.card === null && (
            <Animated.View entering={BounceIn.duration(600).delay(200)}>
              <TouchableOpacity style={styles.drawBtn} onPress={handleFlip} disabled={isFlipping}>
                <Text style={styles.drawBtnText}>{isFlipping ? 'Drawing...' : 'DRAW CARD'}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          <Animated.View entering={FadeInUp.duration(600).delay(600)} style={styles.scoreboard}>
            <Text style={styles.scoreTitle}>DRAW RESULTS</Text>
            <ScrollView style={{width: '100%', maxHeight: 150}}>
              {pArr.map(p => (
                <View key={p.id} style={styles.scoreRow}>
                  <Text style={styles.scoreName}>{p.name}</Text>
                  <Text style={[styles.scoreValue, p.card && (p.card.suit === '♥️' || p.card.suit === '♦️') && {color: '#FF4081'}]}>
                    {p.card !== null ? `${p.card.value} ${p.card.suit}` : 'Waiting...'}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>

        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,10,20,0.95)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 50,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    color: '#00E5FF',
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: '#00E5FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  gameArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 40,
  },
  glassPanel: {
    width: '90%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 30,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  winnerText: {
    color: '#00E5FF',
    fontSize: 24,
    marginBottom: 30,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowRadius: 10,
  },
  lastAction: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 30,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardContainer: {
    width: 140,
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
    position: 'relative',
  },
  cardGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: 'rgba(0,229,255,0.2)',
    zIndex: -1,
  },
  cardBack: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    borderWidth: 6,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardFront: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 20,
  },
  cardTopLeft: {
    fontSize: 24,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  cardSuitTop: {
    fontSize: 18,
    alignSelf: 'flex-start',
  },
  cardCenter: {
    fontSize: 60,
    alignSelf: 'center',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  cardBottomRight: {
    fontSize: 24,
    fontWeight: 'bold',
    alignSelf: 'flex-end',
    transform: [{ rotate: '180deg' }]
  },
  cardSuitBottom: {
    fontSize: 18,
    alignSelf: 'flex-end',
    transform: [{ rotate: '180deg' }]
  },
  joinBtn: {
    marginTop: 30,
    backgroundColor: '#FF4081',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  startBtn: {
    marginTop: 15,
    backgroundColor: '#FFD700',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  btnText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
  },
  drawBtn: {
    marginTop: 30,
    backgroundColor: '#00E5FF',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
  },
  drawBtnText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '900',
  },
  scoreboard: {
    width: '100%',
    marginTop: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  scoreTitle: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  scoreName: {
    color: '#fff',
    fontSize: 16,
  },
  scoreValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  rewardBox: {
    width: '100%',
    backgroundColor: '#0d1a00',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 15,
  },
  rewardTitle: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
    textShadowColor: '#FFD700',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  rewardRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  rewardItem: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
  },
  rewardClose: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 25,
  },
  rewardCloseText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },
});
