import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Alert } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

export const GIFTS = [
  { id: '1', name: 'Rose', icon: '🌹', cost: 10, animation: 'https://lottie.host/8e3a2414-9b51-4bb8-8d26-70e1cb2a488c/OaU2Xv3P5X.json' },
  { id: '2', name: 'Coffee', icon: '☕', cost: 50, animation: 'https://lottie.host/ca0debf7-4632-42da-91aa-90a6ea5e0f52/5uA8bM6vRz.json' },
  { id: '3', name: 'Crown', icon: '👑', cost: 500, animation: 'https://lottie.host/80c4ab68-1859-4b6e-bae6-946e4c7ba142/Wv3vY9b2gL.json' },
  { id: '4', name: 'Rocket', icon: '🚀', cost: 1000, animation: 'https://lottie.host/791cce92-4f01-4ec1-a9f7-66a9cb994781/Gq3Uj4X8wY.json' },
];

export default function GiftModal({ visible, onClose, onSendGift, userCoins }) {
  const handleSend = (gift) => {
    if (userCoins < gift.cost) {
      Alert.alert('Insufficient Coins', 'You do not have enough coins to send this gift.');
      return;
    }
    onSendGift(gift);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.giftCard} onPress={() => handleSend(item)}>
      <Text style={styles.giftIcon}>{item.icon}</Text>
      <Text style={styles.giftName}>{item.name}</Text>
      <View style={styles.costBadge}>
        <Ionicons name="cash" size={12} color="#FFD700" />
        <Text style={styles.giftCost}>{item.cost}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOutDown.duration(300)} style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Send a Gift</Text>
              <View style={styles.coinBalance}>
                <Ionicons name="wallet" size={16} color="#FFD700" />
                <Text style={styles.balanceText}>{userCoins}</Text>
              </View>
            </View>
            
            <FlatList
              data={GIFTS}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              numColumns={4}
              contentContainerStyle={styles.grid}
            />
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  coinBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  balanceText: {
    color: '#FFD700',
    marginLeft: 6,
    fontWeight: 'bold',
  },
  grid: {
    paddingBottom: 20,
  },
  giftCard: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    margin: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  giftIcon: {
    fontSize: 32,
    marginBottom: 5,
  },
  giftName: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
  },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  giftCost: {
    color: '#FFD700',
    fontSize: 10,
    marginLeft: 2,
    fontWeight: 'bold',
  },
});
