import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const GAMES = [
  { id: 'dice', name: 'Dice Battle', icon: '🎲', color: '#FF4081', desc: 'Roll a 100-sided die! Highest number wins.' },
  { id: 'cards', name: 'Card Flip', icon: '🃏', color: '#00E5FF', desc: 'Higher or lower? Test your luck.' },
  { id: 'car', name: 'Car Race', icon: '🏎️', color: '#FFD700', desc: 'Multiplayer tap-to-race challenge!' },
  { id: 'ludo', name: 'Ludo Mini', icon: '🎪', color: '#4CAF50', desc: 'Classic 4-player board game.' },
];

export default function GamesHubModal({ visible, onClose, roomId, isHost }) {
  const launchGame = async (gameId) => {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      
      let gameSpecificState = {};
      
      if (gameId === 'ludo') {
        // Initialize empty Ludo state
        gameSpecificState = {
          players: [],
          turnIndex: 0,
          diceRoll: null,
          winner: null,
          actionMessage: 'Wait for players...',
          pawns: {
            red: [
              { id: `red_1`, state: 'base', pos: -1 }, { id: `red_2`, state: 'base', pos: -1 },
              { id: `red_3`, state: 'base', pos: -1 }, { id: `red_4`, state: 'base', pos: -1 }
            ],
            blue: [
              { id: `blue_1`, state: 'base', pos: -1 }, { id: `blue_2`, state: 'base', pos: -1 },
              { id: `blue_3`, state: 'base', pos: -1 }, { id: `blue_4`, state: 'base', pos: -1 }
            ],
            yellow: [
              { id: `yellow_1`, state: 'base', pos: -1 }, { id: `yellow_2`, state: 'base', pos: -1 },
              { id: `yellow_3`, state: 'base', pos: -1 }, { id: `yellow_4`, state: 'base', pos: -1 }
            ],
            green: [
              { id: `green_1`, state: 'base', pos: -1 }, { id: `green_2`, state: 'base', pos: -1 },
              { id: `green_3`, state: 'base', pos: -1 }, { id: `green_4`, state: 'base', pos: -1 }
            ]
          }
        };
      } else if (gameId === 'car') {
        gameSpecificState = {
          players: {},
          status: 'waiting',
          winner: null
        };
      }
      
      const updatePayload = {
        'gameState.activeGame': gameId,
        'gameState.lastAction': null,
        'gameState.updatedAt': Date.now()
      };
      
      if (gameId === 'ludo') updatePayload['gameState.ludo'] = gameSpecificState;
      if (gameId === 'car') updatePayload['gameState.carGame'] = gameSpecificState;

      await updateDoc(roomRef, updatePayload);
      onClose();
    } catch (e) {
      console.error("Error launching game:", e);
      Alert.alert('Error', 'Could not start game.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOutDown.duration(300)} style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Mini Games Hub</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.gamesList}>
              {GAMES.map((game) => (
                <TouchableOpacity 
                  key={game.id} 
                  style={[styles.gameCard, { borderLeftColor: game.color, borderLeftWidth: 4 }]}
                  onPress={() => launchGame(game.id)}
                >
                  <View style={[styles.iconContainer, { backgroundColor: game.color + '20' }]}>
                    <Text style={styles.gameIcon}>{game.icon}</Text>
                  </View>
                  <View style={styles.gameInfo}>
                    <Text style={styles.gameName}>{game.name}</Text>
                    <Text style={styles.gameDesc}>{game.desc}</Text>
                  </View>
                  <Ionicons name="play-circle" size={32} color={game.color} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    minHeight: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
  },
  gamesList: {
    paddingBottom: 20,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  gameIcon: {
    fontSize: 30,
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  gameDesc: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 16,
  },
});
