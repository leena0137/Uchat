// ─────────────────────────────────────────────
//  Economy Constants
// ─────────────────────────────────────────────

export const PLATFORM_CUT = 0.30;        // 30% platform revenue
export const AGENCY_CUT   = 0.20;        // 20% agency commission
export const HOST_CUT_NO_AGENCY = 0.70;  // 70% if no agency
export const HOST_CUT_WITH_AGENCY = 0.50;// 50% if has agency

// 1 coin spent on gift = 1 bean earned by host
export const COINS_TO_BEANS = 1;

export const ROLES = {
  USER:        'user',
  HOST:        'host',
  COIN_SELLER: 'coin_seller',
  AGENCY:      'agency',
  ADMIN:       'admin',
};

export const COIN_PACKAGES = [
  { id: 'pkg_100',  coins: 100,   price: '$0.99',  bonus: 0,    label: 'Starter' },
  { id: 'pkg_500',  coins: 500,   price: '$3.99',  bonus: 50,   label: 'Popular' },
  { id: 'pkg_1000', coins: 1000,  price: '$6.99',  bonus: 150,  label: 'Value' },
  { id: 'pkg_5000', coins: 5000,  price: '$29.99', bonus: 1000, label: 'Premium' },
];

// ─────────────────────────────────────────────
//  Payout Calculator
// ─────────────────────────────────────────────

/**
 * Calculate payout split for a host withdrawal
 * @param {number} beans  - Total beans to cash out
 * @param {boolean} hasAgency - Whether host belongs to an agency
 * @returns {{ hostAmount, agencyAmount, platformAmount }}
 */
export function calculatePayout(beans, hasAgency = false) {
  const platformAmount = Math.floor(beans * PLATFORM_CUT);
  const agencyAmount   = hasAgency ? Math.floor(beans * AGENCY_CUT) : 0;
  const hostAmount     = beans - platformAmount - agencyAmount;
  return { hostAmount, agencyAmount, platformAmount };
}

/**
 * Format beans as currency string (1 bean = $0.001 USD)
 */
export function beansToUSD(beans) {
  return `$${(beans * 0.001).toFixed(2)}`;
}
