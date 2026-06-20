import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInUp, BounceIn, ZoomIn, ZoomOut, ZoomInEasyDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, runOnJS, withDelay } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, setDoc, increment, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { awardWinner, GAME_REWARDS, GAME_FEES } from '../../utils/gameRewards';

export default function DiceGame({ gameState, roomId, onClose, userCoins = 0 }) {
  const [players, setPlayers] = useState({});
  const [status, setStatus] = useState('waiting');
  const [winner, setWinner] = useState(null);
  const [reward, setReward] = useState(null);
  const [showFeePaid, setShowFeePaid] = useState(false);
  const rewardedRef = React.useRef(false);

  const [localRoll, setLocalRoll] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (gameState?.diceGame) {
      setPlayers(gameState.diceGame.players || {});
      setStatus(gameState.diceGame.status || 'waiting');
      const w = gameState.diceGame.winner || null;
      setWinner(w);

      const me = auth.currentUser;
      if (w && me && w.id === me.uid && !rewardedRef.current) {
        rewardedRef.current = true;
        awardWinner(me.uid, 'dice').then(r => r && setReward(r));
      }
    }
  }, [gameState?.diceGame]);

  useEffect(() => {
    if (gameState?.lastAction?.type === 'roll') {
      const rollValue = gameState.lastAction.value;
      setIsRolling(true);
      
      // Intense Rolling Animation
      glowOpacity.value = withRepeat(withTiming(1, { duration: 150 }), 6, true);
      scale.value = withSequence(
        withTiming(1.5, { duration: 250 }),
        withTiming(1, { duration: 750, easing: Easing.bounce })
      );
      rotation.value = withTiming(rotation.value + 1440, { 
        duration: 1000, 
        easing: Easing.bezier(0.25, 0.1, 0.25, 1) 
      }, (finished) => {
        if (finished) {
          runOnJS(setLocalRoll)(rollValue);
          runOnJS(setIsRolling)(false);
        }
      });
    } else {
      setLocalRoll(null);
    }
  }, [gameState?.lastAction?.timestamp]);

  const joinGame = async () => {
    const user = auth.currentUser;
    if (!user || players[user.uid]) return;
    
    const fee = GAME_FEES.dice.coins;
    const userRef = doc(db, 'users', user.uid);
    
    try {
      const snap = await getDoc(userRef);
      const userCoins = snap.exists() ? (snap.data().coins || 0) : 0;

      if (userCoins < fee) {
        Alert.alert('Not enough Coins', `You need ${fee} coins to enter this game. Please buy more from the Coin Shop!`);
        return;
      }
      
      // 1. Deduct Entry Fee
      await setDoc(userRef, { coins: increment(-fee) }, { merge: true });
      
      // 2. Show flashy -50 Coins animation
      setShowFeePaid(true);
      setTimeout(() => setShowFeePaid(false), 2000);

      // 3. Add to game
      await updateDoc(doc(db, 'rooms', roomId), {
        [`gameState.diceGame.players.${user.uid}`]: {
          id: user.uid,
          name: user.displayName || 'Player',
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
        'gameState.diceGame.status': 'playing',
        'gameState.diceGame.winner': null
      });
    } catch (e) {}
  };

  const handleRoll = async () => {
    if (isRolling || status !== 'playing') return;
    const user = auth.currentUser;
    if (!user || !players[user.uid] || players[user.uid].score !== null) return;

    const result = Math.floor(Math.random() * 100) + 1;
    
    const newPlayers = { ...players };
    newPlayers[user.uid].score = result;

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
          type: 'roll',
          userId: user.uid,
          userName: user.displayName || 'Player',
          value: result,
          timestamp: Date.now()
        },
        'gameState.diceGame.players': newPlayers,
        ...(isFinished ? {
          'gameState.diceGame.status': 'finished',
          'gameState.diceGame.winner': currentWinner
        } : {})
      });
    } catch (e) {}
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value }
      ],
    };
  });
  
  const glowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value
    };
  });

  const pArr = Object.values(players);
  const myPlayer = players[auth.currentUser?.uid];
  const allRolled = pArr.every(p => p.score !== null);
  const isHost = true; // In the original code this was a prop

  return (
    <View style={styles.container}>
      {/* Massive Winner Overlay */}
      {status === 'finished' && winner && (
        <Animated.View entering={ZoomIn.duration(800).springify()} style={styles.massiveWinnerOverlay}>
          <Text style={styles.massiveWinnerText}>{winner.name} WINS!</Text>
          <Text style={styles.massiveWinnerScore}>Score: {winner.score}</Text>
        </Animated.View>
      )}

      {/* Reward Claim Popup */}
      {reward && (
        <Animated.View entering={BounceIn.duration(800)} exiting={ZoomOut} style={styles.rewardBox}>
          <Ionicons name="diamond" size={50} color="#00FFFF" style={{marginBottom: 10}} />
          <Text style={styles.rewardTitle}>JACKPOT!</Text>
          <Text style={styles.rewardDesc}>You won {reward.diamonds} Diamonds!</Text>
          <TouchableOpacity onPress={() => setReward(null)} style={styles.rewardClose}>
            <Text style={styles.rewardCloseText}>COLLECT REWARD</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <Text style={styles.title}>DICE ARENA</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close-circle" size={30} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.gameArea}>
        <Animated.View entering={FadeInUp.duration(700).delay(200)} style={styles.glassPanel}>
          
          <Animated.Text entering={FadeInDown.duration(400).delay(300)} style={styles.lastRoller}>
            {status === 'waiting' ? 'Waiting for players...' : 
             status === 'playing' && myPlayer?.score === null ? 'YOUR TURN TO ROLL!' : 
             status === 'finished' ? 'GAME OVER!' : 'Waiting for others to roll...'}
          </Animated.Text>
          
          <TouchableOpacity activeOpacity={0.8} onPress={handleRoll} disabled={isRolling || status !== 'playing' || myPlayer?.score !== null}>
            <Animated.View style={[styles.diceContainer, animatedStyle]}>
              <Animated.View style={[styles.diceGlow, glowStyle]} />
              <Text style={styles.diceText}>
                {isRolling ? '?' : (localRoll || '🎲')}
              </Text>
            </Animated.View>
          </TouchableOpacity>
          
          {/* Entry Fee Floating Animation */}
          {showFeePaid && (
            <Animated.View entering={FadeInUp.duration(400)} exiting={ZoomOut} style={styles.feePaidPopup}>
              <Text style={styles.feePaidText}>-{GAME_FEES.dice.coins} Coins 🪙</Text>
            </Animated.View>
          )}

          {status === 'waiting' && !myPlayer && (
            <Animated.View entering={ZoomInEasyDown.duration(500).delay(400)}>
              <TouchableOpacity style={styles.joinBtn} onPress={joinGame}>
                <Text style={styles.btnText}>JOIN GAME ({GAME_FEES.dice.coins} 🪙)</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {status === 'waiting' && pArr.length > 0 && (
            <Animated.View entering={ZoomInEasyDown.duration(500).delay(500)}>
              <TouchableOpacity style={styles.startBtn} onPress={startGame}>
                <Text style={styles.btnText}>START BATTLE</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {status === 'playing' && myPlayer && myPlayer.score === null && (
            <Animated.View entering={BounceIn.duration(600).delay(200)}>
              <TouchableOpacity style={styles.rollBtn} onPress={handleRoll} disabled={isRolling}>
                <Text style={styles.rollBtnText}>{isRolling ? 'Rolling...' : 'ROLL DICE'}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          
          <Animated.View entering={FadeInUp.duration(600).delay(600)} style={styles.scoreboard}>
            <Text style={styles.scoreTitle}>SCOREBOARD</Text>
            <ScrollView style={{width: '100%', maxHeight: 150}}>
              {pArr.map(p => (
                <View key={p.id} style={styles.scoreRow}>
                  <Text style={styles.scoreName}>{p.name}</Text>
                  <Text style={styles.scoreValue}>{p.score !== null ? p.score : 'Waiting...'}</Text>
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
    backgroundColor: 'rgba(10,5,20,0.95)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  massiveWinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  massiveWinnerText: {
    fontSize: 50,
    fontWeight: '900',
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: '#FF3B8B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 10,
  },
  massiveWinnerScore: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
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
    color: '#FF4081',
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: '#FF4081',
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
  lastRoller: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 30,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  diceContainer: {
    width: 140,
    height: 140,
    backgroundColor: '#fff',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4081',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 6,
    borderColor: '#FF4081',
  },
  diceGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 35,
    backgroundColor: 'rgba(255,64,129,0.8)',
  },
  diceText: {
    fontSize: 60,
    fontWeight: '900',
    color: '#000',
    zIndex: 10,
  },
  feePaidPopup: {
    position: 'absolute',
    top: 60,
    backgroundColor: '#FF3B3B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 50,
    borderWidth: 1,
    borderColor: '#fff',
  },
  feePaidText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  joinBtn: {
    marginTop: 30,
    backgroundColor: '#00E5FF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    shadowColor: '#00E5FF',
    shadowRadius: 10,
    shadowOpacity: 0.5,
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
    fontSize: 16,
    fontWeight: '900',
  },
  rollBtn: {
    marginTop: 30,
    backgroundColor: '#FF4081',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#FF4081',
    shadowOpacity: 0.6,
    shadowRadius: 15,
  },
  rollBtnText: {
    color: '#fff',
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
    color: '#FF4081',
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
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rewardBox: {
    position: 'absolute',
    top: '30%',
    width: '80%',
    backgroundColor: '#0d1a00',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#00FFFF',
    padding: 30,
    alignItems: 'center',
    zIndex: 10000,
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 20,
  },
  rewardTitle: {
    color: '#00FFFF',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 10,
    textShadowColor: '#00FFFF',
    textShadowRadius: 10,
  },
  rewardDesc: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 25,
  },
  rewardClose: {
    backgroundColor: '#00FFFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  rewardCloseText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },
});
