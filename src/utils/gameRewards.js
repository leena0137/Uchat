import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Entry Fees to join games
export const GAME_FEES = {
  car:   { coins: 100 },
  ludo:  { coins: 100 },
  dice:  { coins: 50  },
  cards: { coins: 50  },
};

// Reward amounts per game
export const GAME_REWARDS = {
  car:   { coins: 200, diamonds: 20 },
  ludo:  { coins: 300, diamonds: 50 },
  dice:  { coins: 100, diamonds: 10 },
  cards: { coins: 100, diamonds: 10 },
};

/**
 * Awards coins and diamonds to the winner.
 * @param {string} userId   - UID of the winner
 * @param {string} gameType - one of 'car' | 'ludo' | 'dice' | 'cards'
 */
export async function awardWinner(userId, gameType) {
  if (!userId || !GAME_REWARDS[gameType]) return null;

  const reward = GAME_REWARDS[gameType];
  const userRef = doc(db, 'users', userId);

  try {
    const snap = await getDoc(userRef);
    const current = snap.exists() ? snap.data() : {};
    const currentCoins    = current.coins    || 0;
    const currentDiamonds = current.diamonds || 0;

    await setDoc(userRef, {
      coins:    currentCoins    + reward.coins,
      diamonds: currentDiamonds + reward.diamonds,
    }, { merge: true });

    return reward;
  } catch (e) {
    console.error('awardWinner error:', e);
    return null;
  }
}
