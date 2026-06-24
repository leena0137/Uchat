import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import Animated, { FadeInDown, FadeInUp, BounceIn, ZoomIn, FlipInXUp, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, setDoc, increment, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { awardWinner, GAME_REWARDS, GAME_FEES } from '../../utils/gameRewards';

const screenWidth = Dimensions.get('window').width;
const BOARD_SIZE = Math.min(screenWidth * 0.95, 400);
const CELL_SIZE = BOARD_SIZE / 15;

const COLORS = {
  red: '#FF4081',
  blue: '#00E5FF',
  yellow: '#FFD700',
  green: '#4CAF50',
};

// Main outer track coordinates (52 steps)
const TRACK = [
  // Red start path
  {x:1,y:6},{x:2,y:6},{x:3,y:6},{x:4,y:6},{x:5,y:6},
  {x:6,y:5},{x:6,y:4},{x:6,y:3},{x:6,y:2},{x:6,y:1},{x:6,y:0},
  {x:7,y:0},{x:8,y:0},
  // Blue start path
  {x:8,y:1},{x:8,y:2},{x:8,y:3},{x:8,y:4},{x:8,y:5},
  {x:9,y:6},{x:10,y:6},{x:11,y:6},{x:12,y:6},{x:13,y:6},{x:14,y:6},
  {x:14,y:7},{x:14,y:8},
  // Yellow start path
  {x:13,y:8},{x:12,y:8},{x:11,y:8},{x:10,y:8},{x:9,y:8},
  {x:8,y:9},{x:8,y:10},{x:8,y:11},{x:8,y:12},{x:8,y:13},{x:8,y:14},
  {x:7,y:14},{x:6,y:14},
  // Green start path
  {x:6,y:13},{x:6,y:12},{x:6,y:11},{x:6,y:10},{x:6,y:9},
  {x:5,y:8},{x:4,y:8},{x:3,y:8},{x:2,y:8},{x:1,y:8},{x:0,y:8},
  {x:0,y:7},{x:0,y:6}
];

const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

const HOME_TRACKS = {
  red: [{x:1,y:7},{x:2,y:7},{x:3,y:7},{x:4,y:7},{x:5,y:7}],
  blue: [{x:7,y:1},{x:7,y:2},{x:7,y:3},{x:7,y:4},{x:7,y:5}],
  yellow: [{x:13,y:7},{x:12,y:7},{x:11,y:7},{x:10,y:7},{x:9,y:7}],
  green: [{x:7,y:13},{x:7,y:12},{x:7,y:11},{x:7,y:10},{x:7,y:9}],
};

const START_INDEX = { red: 0, blue: 13, yellow: 26, green: 39 };

const getInitialPawns = () => {
  return ['red', 'blue', 'yellow', 'green'].reduce((acc, color) => {
    acc[color] = [
      { id: `${color}_1`, state: 'base', pos: -1 },
      { id: `${color}_2`, state: 'base', pos: -1 },
      { id: `${color}_3`, state: 'base', pos: -1 },
      { id: `${color}_4`, state: 'base', pos: -1 },
    ];
    return acc;
  }, {});
};

export default function LudoGame({ gameState, roomId, onClose, isHost }) {
  const [players, setPlayers] = useState([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [diceRoll, setDiceRoll] = useState(null);
  const [winner, setWinner] = useState(null);
  const [pawns, setPawns] = useState(getInitialPawns());
  const [actionMessage, setActionMessage] = useState('Wait for players...');
  const [reward, setReward] = useState(null);
  const rewardedRef = React.useRef(false);

  useEffect(() => {
    if (gameState?.ludo) {
      setPlayers(gameState.ludo.players || []);
      setTurnIndex(gameState.ludo.turnIndex || 0);
      setDiceRoll(gameState.ludo.diceRoll || null);
      const w = gameState.ludo.winner || null;
      setWinner(w);
      if (gameState.ludo.pawns) setPawns(gameState.ludo.pawns);
      if (gameState.ludo.actionMessage) setActionMessage(gameState.ludo.actionMessage);

      // Award winner once
      const me = auth.currentUser;
      if (w && me && w.id === me.uid && !rewardedRef.current) {
        rewardedRef.current = true;
        awardWinner(me.uid, 'ludo').then(r => r && setReward(r));
      }
    }
  }, [gameState?.ludo]);

  const joinGame = async () => {
    const user = auth.currentUser;
    if (!user || players.length >= 4 || players.find(p => p.id === user.uid)) return;

    const fee = GAME_FEES.ludo.coins;
    const userRef = doc(db, 'users', user.uid);

    try {
      const snap = await getDoc(userRef);
      const userCoins = snap.exists() ? (snap.data().coins || 0) : 0;
      
      if (userCoins < fee) {
        Alert.alert('Not enough Coins', `You need ${fee} coins to enter this game. Buy more in the Coin Shop!`);
        return;
      }
      
      await setDoc(userRef, { coins: increment(-fee) }, { merge: true });

      const colors = ['red', 'blue', 'yellow', 'green'];
      const newPlayer = {
        id: user.uid,
        name: user.displayName || 'Player',
        color: colors[players.length],
      };

      await updateDoc(doc(db, 'rooms', roomId), {
        'gameState.ludo.players': [...players, newPlayer],
        'gameState.ludo.actionMessage': `${newPlayer.name} joined as ${newPlayer.color.toUpperCase()}`
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to join game.');
    }
  };

  const rollDice = async () => {
    const user = auth.currentUser;
    if (!user || winner || players[turnIndex]?.id !== user.uid) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    
    // Check if player has ANY valid moves
    const myColor = players[turnIndex].color;
    const myPawns = pawns[myColor];
    
    let hasMove = false;
    myPawns.forEach(p => {
      if (p.state === 'base' && roll === 6) hasMove = true;
      if (p.state === 'track' && p.pos + roll <= 56) hasMove = true;
    });

    try {
      if (!hasMove) {
        await updateDoc(doc(db, 'rooms', roomId), {
          'gameState.ludo.diceRoll': roll,
          'gameState.ludo.actionMessage': `Rolled ${roll}. No moves. Passing turn...`
        });
        
        // Wait 2 seconds so players can see the dice roll before passing turn
        setTimeout(async () => {
          const nextTurn = (turnIndex + 1) % players.length;
          await updateDoc(doc(db, 'rooms', roomId), {
            'gameState.ludo.diceRoll': null,
            'gameState.ludo.turnIndex': nextTurn,
            'gameState.ludo.actionMessage': `Wait for players...`
          });
        }, 2000);

      } else {
        await updateDoc(doc(db, 'rooms', roomId), {
          'gameState.ludo.diceRoll': roll,
          'gameState.ludo.actionMessage': `Rolled ${roll}. Select a pawn!`
        });
      }
    } catch (e) {}
  };

  const movePawn = async (color, pawnId) => {
    const user = auth.currentUser;
    if (!user || !diceRoll || players[turnIndex]?.id !== user.uid || players[turnIndex]?.color !== color) return;

    const p = pawns[color].find(p => p.id === pawnId);
    let newPawns = JSON.parse(JSON.stringify(pawns)); // Deep copy
    let targetPawn = newPawns[color].find(p => p.id === pawnId);
    
    let moveSuccessful = false;
    let killed = false;

    if (p.state === 'base' && diceRoll === 6) {
      targetPawn.state = 'track';
      targetPawn.pos = 0; // Relative position
      moveSuccessful = true;
    } else if (p.state === 'track' && p.pos + diceRoll <= 56) {
      targetPawn.pos += diceRoll;
      if (targetPawn.pos === 56) targetPawn.state = 'home';
      moveSuccessful = true;
    }

    if (!moveSuccessful) return;

    // Check collision (Killing)
    if (targetPawn.state === 'track' && targetPawn.pos < 51) {
      const absPos = (START_INDEX[color] + targetPawn.pos) % 52;
      
      if (!SAFE_ZONES.includes(absPos)) {
        // Check all other players' pawns
        ['red', 'blue', 'yellow', 'green'].forEach(c => {
          if (c !== color) {
            newPawns[c].forEach(enemy => {
              if (enemy.state === 'track' && enemy.pos < 51) {
                const enemyAbsPos = (START_INDEX[c] + enemy.pos) % 52;
                if (absPos === enemyAbsPos) {
                  enemy.state = 'base';
                  enemy.pos = -1;
                  killed = true;
                }
              }
            });
          }
        });
      }
    }

    // Check win condition
    const isWin = newPawns[color].every(p => p.state === 'home');
    const newWinner = isWin ? players[turnIndex] : winner;

    // Turn logic
    let nextTurn = turnIndex;
    let msg = `Moved pawn!`;
    if (diceRoll !== 6 && !killed) {
      nextTurn = (turnIndex + 1) % players.length;
    } else {
      msg = killed ? `KILLED AN ENEMY! Roll again!` : `Rolled a 6! Roll again!`;
    }

    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        'gameState.ludo.pawns': newPawns,
        'gameState.ludo.diceRoll': null,
        'gameState.ludo.turnIndex': nextTurn,
        'gameState.ludo.winner': newWinner,
        'gameState.ludo.actionMessage': msg
      });
    } catch (e) {}
  };

  const getPawnPixelPos = (color, p) => {
    if (p.state === 'base') {
      const baseCoords = {
        red: { x: 2, y: 2 }, blue: { x: 11, y: 2 },
        yellow: { x: 11, y: 11 }, green: { x: 2, y: 11 }
      };
      // Offset 4 pawns into a 2x2 grid inside the base
      const idx = parseInt(p.id.split('_')[1]) - 1;
      const dx = idx % 2 === 0 ? -1 : 1;
      const dy = idx < 2 ? -1 : 1;
      return { x: baseCoords[color].x + dx, y: baseCoords[color].y + dy };
    }
    if (p.state === 'track') {
      if (p.pos < 51) {
        const absPos = (START_INDEX[color] + p.pos) % 52;
        return TRACK[absPos];
      } else if (p.pos < 56) {
        return HOME_TRACKS[color][p.pos - 51];
      } else {
        return { x: 7, y: 7 }; // Home Center
      }
    }
    return { x: 7, y: 7 };
  };

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.title}>REAL 3D LUDO</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close-circle" size={30} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.gameArea}>

        {/* Reward Overlay */}
        {reward && (
          <Animated.View entering={ZoomIn.duration(500).springify()} style={styles.rewardBox}>
            <Text style={styles.rewardTitle}>🏆 LUDO CHAMPION!</Text>
            <View style={styles.rewardRow}>
              <Text style={styles.rewardItem}>🪙 +{reward.coins}</Text>
              <Text style={styles.rewardItem}>💎 +{reward.diamonds}</Text>
            </View>
            <TouchableOpacity onPress={() => setReward(null)} style={styles.rewardClose}>
              <Text style={styles.rewardCloseText}>Claim!</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {winner ? (
          <Animated.Text entering={BounceIn.duration(800)} style={[styles.winnerText, { color: COLORS[winner.color] }]}>{winner.name} WINS! 🎉</Animated.Text>
        ) : (
          <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.turnInfo}>
            {players.length > 0 ? (
              <Text style={styles.turnText}>Turn: <Text style={{ color: COLORS[players[turnIndex]?.color], fontWeight: '900' }}>{players[turnIndex]?.name}</Text></Text>
            ) : (
              <Text style={styles.turnText}>Waiting for players...</Text>
            )}
            
            {players.find(p => p.id === auth.currentUser?.uid) && players[turnIndex]?.id === auth.currentUser?.uid && !diceRoll && (
              <TouchableOpacity style={styles.rollBtn} onPress={rollDice}>
                <Text style={styles.rollBtnText}>ROLL</Text>
              </TouchableOpacity>
            )}

            {diceRoll && (
              <Animated.View entering={BounceIn.duration(600)} style={styles.diceResult}>
                <Text style={styles.diceNumber}>{diceRoll}</Text>
              </Animated.View>
            )}
          </Animated.View>
        )}
        
        <Text style={styles.actionMessage}>{actionMessage}</Text>

        <Animated.View entering={FadeInUp.duration(800).delay(300)} style={styles.isometricContainer}>
          <View style={styles.board}>
            
            {/* Draw 15x15 Grid Track Backgrounds */}
            {Array.from({ length: 15 }).map((_, y) => 
              Array.from({ length: 15 }).map((_, x) => {
                let cellColor = '#1a1a1a';
                let isTrack = false;
                
                // Bases
                if (x < 6 && y < 6) cellColor = COLORS.red;
                else if (x > 8 && y < 6) cellColor = COLORS.blue;
                else if (x > 8 && y > 8) cellColor = COLORS.yellow;
                else if (x < 6 && y > 8) cellColor = COLORS.green;
                // Center
                else if (x >= 6 && x <= 8 && y >= 6 && y <= 8) cellColor = '#000';
                else isTrack = true;

                // Color home tracks
                if (isTrack) {
                  if (y === 7 && x >= 1 && x <= 5) cellColor = COLORS.red;
                  if (x === 7 && y >= 1 && y <= 5) cellColor = COLORS.blue;
                  if (y === 7 && x >= 9 && x <= 13) cellColor = COLORS.yellow;
                  if (x === 7 && y >= 9 && y <= 13) cellColor = COLORS.green;
                }

                return (
                  <View key={`cell_${x}_${y}`} style={[styles.cell, { left: x * CELL_SIZE, top: y * CELL_SIZE, backgroundColor: cellColor }]} />
                );
              })
            )}

            {/* Draw Pawns */}
            {['red', 'blue', 'yellow', 'green'].map(color => 
              pawns[color].map(p => {
                if (p.state === 'home') return null;
                const pos = getPawnPixelPos(color, p);
                const isMyTurn = players[turnIndex]?.id === auth.currentUser?.uid && players[turnIndex]?.color === color && diceRoll;
                
                return (
                  <TouchableOpacity 
                    key={p.id}
                    disabled={!isMyTurn}
                    onPress={() => movePawn(color, p.id)}
                    style={[
                      styles.pawn3D, 
                      { 
                        left: pos.x * CELL_SIZE + (CELL_SIZE/4), 
                        top: pos.y * CELL_SIZE + (CELL_SIZE/4),
                        backgroundColor: COLORS[color],
                        borderColor: isMyTurn ? '#fff' : '#000',
                        borderWidth: isMyTurn ? 3 : 2,
                        zIndex: p.state === 'track' ? 100 : 10
                      }
                    ]}
                  />
                );
              })
            )}

          </View>
        </Animated.View>

        {players.length < 4 && !players.find(p => p.id === auth.currentUser?.uid) && (
          <Animated.View entering={FadeInDown.duration(600).delay(500)}>
            <TouchableOpacity style={styles.joinBtn} onPress={joinGame}>
              <Text style={styles.btnText}>JOIN LUDO ({GAME_FEES.ludo.coins} 🪙)</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,15,0.95)',
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
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: '#00E5FF',
    textShadowRadius: 15,
  },
  gameArea: {
    width: '100%',
    flex: 1,
    marginTop: 80,
    alignItems: 'center',
  },
  winnerText: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 20,
    textShadowColor: '#000',
    textShadowRadius: 10,
  },
  turnInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  turnText: {
    color: '#fff',
    fontSize: 20,
    marginRight: 20,
  },
  rollBtn: {
    backgroundColor: '#FF4081',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#FF4081',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  rollBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  diceResult: {
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#00E5FF',
  },
  diceNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
  },
  actionMessage: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  isometricContainer: {
    transform: [
      { perspective: 1000 },
      { rotateX: '55deg' },
      { rotateZ: '-45deg' }
    ],
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    backgroundColor: '#000',
    borderWidth: 5,
    borderColor: '#00E5FF',
    position: 'relative',
  },
  cell: {
    position: 'absolute',
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  pawn3D: {
    position: 'absolute',
    width: CELL_SIZE * 0.6,
    height: CELL_SIZE * 0.6,
    borderRadius: CELL_SIZE * 0.3,
    shadowColor: '#000',
    shadowOffset: { width: -5, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 15,
  },
  joinBtn: {
    marginTop: 50,
    backgroundColor: '#00E5FF',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  btnText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '900',
  },
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
    fontSize: 28,
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
    fontSize: 24,
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
});
